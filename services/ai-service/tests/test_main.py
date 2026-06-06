from __future__ import annotations

import base64
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from app.ai_runtime import AICoreRuntime
from app.main import app


class FakeAiRuntime:
    def assistant(self, request: dict[str, object], simulation: dict[str, object]) -> dict[str, object]:
        return {
            "answer": "Modelo local listo.",
            "recommendations": ["Usá el flujo propuesto."],
            "suggestedRules": {"nodes": []},
            "modelSource": "ollama",
        }

    def voice_intake(self, request: dict[str, object]) -> dict[str, object]:
        has_audio = bool(request.get("audioBase64"))
        transcript = str(request.get("text") or "Quiero reportar una demora administrativa")
        return {
            "transcript": transcript,
            "source": "audio" if has_audio and not request.get("text") else "text",
            "confidence": 0.94,
            "modelSource": "tensorflow",
            "structuredFields": {"intent": "request", "routeHint": "legal", "summary": transcript[:160]},
            "policyAssignment": "legal-workflow",
            "suggestedNextAction": "Route to LEGAL workflow review.",
        }

    def analyst_insights(self, request: dict[str, object]) -> dict[str, object]:
        return {
            "route": "LEGAL",
            "risk": "HIGH",
            "priority": "HIGH",
            "anomalies": ["Cola alta detectada."] ,
            "confidence": 0.91,
            "summary": "Route LEGAL; risk HIGH; priority HIGH.",
            "modelSource": "tensorflow",
            "recommendedActions": ["Escalate review."],
        }

    def report_draft(self, request: dict[str, object]) -> dict[str, object]:
        text = str(request.get("text") or request.get("transcript") or "")
        if not text:
            return {
                "draftTitle": "",
                "draftBody": "",
                "missingFields": ["text_or_audio"],
                "clarification": "Necesito texto o audio para redactar el informe.",
                "confidence": 0.0,
                "modelSource": "ollama",
                "reportType": None,
            }
        return {
            "draftTitle": "Borrador de reporte",
            "draftBody": text,
            "missingFields": [],
            "clarification": None,
            "confidence": 0.93,
            "modelSource": "ollama",
            "reportType": "operational-risk",
        }

    def form_assist(self, request: dict[str, object]) -> dict[str, object]:
        text = str(request.get("text") or "")
        return {
            "transcript": text,
            "source": "text",
            "confidence": 0.9,
            "modelSource": "ollama",
            "suggestedFields": [{"fieldId": "motivo", "label": "Motivo", "type": "LONG_TEXT", "suggestedValue": text, "confidence": 0.9, "source": "ollama"}],
            "missingFields": [],
            "clarification": None,
        }


class FailingTranscriber:
    def transcribe_base64(self, audio_base64: str) -> str:
        raise ValueError("max() arg is an empty sequence")


class NoopDlCore:
    def predict(self, text: str, history: object) -> dict[str, object]:
        raise AssertionError("predict should not be called for silent audio")


class NoopOllamaClient:
    def chat_json(self, system_prompt: str, user_payload: dict[str, object], *, temperature: float = 0.2) -> dict[str, object]:
        raise AssertionError("chat_json should not be called for silent audio")


class AiServiceEndpointsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.runtime_patch = patch("app.main.get_ai_runtime", return_value=FakeAiRuntime())
        self.runtime_patch.start()

    def tearDown(self) -> None:
        self.runtime_patch.stop()

    def test_voice_intake_from_text_returns_structured_fields(self) -> None:
        response = self.client.post("/voice/intake", json={"text": "Necesito una revisión legal urgente"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["transcript"], "Necesito una revisión legal urgente")
        self.assertEqual(body["source"], "text")
        self.assertEqual(body["modelSource"], "tensorflow")
        self.assertEqual(body["structuredFields"]["intent"], "request")
        self.assertEqual(body["structuredFields"]["routeHint"], "legal")
        self.assertEqual(body["policyAssignment"], "legal-workflow")

    def test_voice_intake_from_audio_decodes_payload(self) -> None:
        audio_text = "Quiero reportar una demora administrativa"
        response = self.client.post(
            "/voice/intake",
            json={"audioBase64": base64.b64encode(audio_text.encode("utf-8")).decode("ascii")},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("demora administrativa", body["transcript"])
        self.assertEqual(body["source"], "audio")
        self.assertGreaterEqual(body["confidence"], 0.9)
        self.assertEqual(body["suggestedNextAction"], "Route to LEGAL workflow review.")

    def test_voice_intake_handles_silent_audio_without_crashing(self) -> None:
        runtime = AICoreRuntime(
            ollama_client=NoopOllamaClient(),
            dl_core=NoopDlCore(),
            transcriber=FailingTranscriber(),
        )

        with patch("app.main.get_ai_runtime", return_value=runtime):
            response = self.client.post("/voice/intake", json={"audioBase64": base64.b64encode(b"silent-wav").decode("ascii")})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["transcript"], "")
        self.assertEqual(body["source"], "empty")
        self.assertEqual(body["confidence"], 0.0)
        self.assertEqual(body["suggestedNextAction"], "Provide text or audio to analyze.")

    def test_analyst_insights_flags_high_risk_and_route(self) -> None:
        response = self.client.post(
            "/analyst/insights",
            json={
                "requestText": "El trámite legal tiene mucha demora y firma pendiente",
                "history": [
                    {"departmentId": "legal", "taskType": "REVISION", "durationHours": 8, "queueSize": 7, "reworkCount": 2, "waitingSignatureHours": 6, "completed": True},
                    {"departmentId": "legal", "taskType": "REVISION", "durationHours": 9, "queueSize": 8, "reworkCount": 3, "waitingSignatureHours": 7, "completed": True},
                    {"departmentId": "legal", "taskType": "REVISION", "durationHours": 10, "queueSize": 9, "reworkCount": 4, "waitingSignatureHours": 8, "completed": True},
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["route"], "LEGAL")
        self.assertEqual(body["risk"], "HIGH")
        self.assertEqual(body["priority"], "HIGH")
        self.assertTrue(body["anomalies"])
        self.assertEqual(body["modelSource"], "tensorflow")
        self.assertTrue(body["recommendedActions"])

    def test_analyst_insights_degrades_without_history(self) -> None:
        response = self.client.post("/analyst/insights", json={"requestText": "Solicitud normal de registro"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["route"], "LEGAL")
        self.assertEqual(body["risk"], "HIGH")
        self.assertGreaterEqual(body["confidence"], 0.9)

    def test_report_draft_from_text_builds_a_structured_summary(self) -> None:
        response = self.client.post(
            "/reports/draft",
            json={"text": "Se recibió una solicitud con demora y firma pendiente."},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("demora", body["draftBody"].lower())
        self.assertEqual(body["missingFields"], [])
        self.assertGreaterEqual(body["confidence"], 0.9)
        self.assertEqual(body["modelSource"], "ollama")
        self.assertEqual(body["reportType"], "operational-risk")

    def test_report_draft_requests_clarification_when_input_is_missing(self) -> None:
        response = self.client.post("/reports/draft", json={})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("missingFields", body)
        self.assertTrue(body["missingFields"])
        self.assertIn("clarification", body)
        self.assertEqual(body["modelSource"], "ollama")

    def test_form_assist_suggests_field_values(self) -> None:
        response = self.client.post(
            "/form/assist",
            json={
                "text": "Solicito revisión legal urgente y confirmo la firma requerida.",
                "policyName": "Política legal",
                "context": {"clientName": "Ana Pérez"},
                "formFields": [
                    {"id": "motivo", "label": "Motivo", "type": "LONG_TEXT", "required": True},
                    {"id": "confirmacion", "label": "Confirmación", "type": "CHECKBOX", "required": True},
                    {"id": "firma", "label": "Firma", "type": "SIGNATURE", "required": True},
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["source"], "text")
        self.assertEqual(body["modelSource"], "ollama")
        self.assertTrue(body["suggestedFields"])
        self.assertIn("motivo", [field["fieldId"] for field in body["suggestedFields"]])
        self.assertNotIn("clientName", [field["fieldId"] for field in body["suggestedFields"]])

    def test_voice_intake_uses_tensorflow_contract_when_enabled(self) -> None:
        with patch.dict(os.environ, {"AI_CORE_PROVIDER": "tensorflow", "AI_CORE_FORCE_MOCK": "true"}, clear=False):
            response = self.client.post("/voice/intake", json={"text": "Necesito una revisión legal urgente"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["modelSource"], "tensorflow")
        self.assertEqual(body["policyAssignment"], "legal-workflow")
        self.assertIn("Route to LEGAL", body["suggestedNextAction"])

    def test_analyst_insights_uses_tensorflow_contract_when_enabled(self) -> None:
        with patch.dict(os.environ, {"AI_CORE_PROVIDER": "tensorflow", "AI_CORE_FORCE_MOCK": "true"}, clear=False):
            response = self.client.post("/analyst/insights", json={"requestText": "Demora urgente en revisión legal"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["modelSource"], "tensorflow")
        self.assertEqual(body["route"], "LEGAL")
        self.assertTrue(body["recommendedActions"])


if __name__ == "__main__":
    unittest.main()

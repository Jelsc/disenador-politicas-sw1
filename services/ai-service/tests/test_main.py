from __future__ import annotations

import base64
import httpx
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from app.ai_runtime import AICoreRuntime, AzureOpenAIClient, OllamaClient
from app.main import app
from app.tensorflow_core import TensorFlowCoreAdapter


class FakeAiRuntime:
    def assistant(self, request: dict[str, object], simulation: dict[str, object]) -> dict[str, object]:
        return {
            "answer": "Modelo local listo.",
            "recommendations": ["Usá el flujo propuesto."],
            "suggestedRules": {"departments": [], "laneHeights": {}, "nodes": [], "connectors": []},
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
                "modelSource": "heuristic",
                "reportType": None,
            }
        return {
            "draftTitle": "Borrador de reporte",
            "draftBody": (
                '<div class="report-draft">'
                '<section><h2>Executive Summary</h2><p>Borrador local preparado sin depender de Ollama.</p></section>'
                f'<section><h2>Input Snapshot</h2><p>{text}</p></section>'
                '<section><h2>Context Signals</h2><ul><li>Estado operativo local confirmado.</li></ul></section>'
                '<section><h2>Next Steps</h2><ul><li>Revisar y completar los datos operativos confirmados.</li></ul></section>'
                '</div>'
            ),
            "missingFields": [],
            "clarification": None,
            "confidence": 0.93,
            "modelSource": "tensorflow",
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


class FailingAssistantRuntime:
    def assistant(self, request: dict[str, object], simulation: dict[str, object]) -> dict[str, object]:
        raise TimeoutError("ollama timed out")


class StaleAssistantRuntime:
    def assistant(self, request: dict[str, object], simulation: dict[str, object]) -> dict[str, object]:
        return {
            "answer": "Propuse un flujo local con TensorFlow y Ollama.",
            "recommendations": ["Revisar coherencia del flujo."],
            "suggestedRules": {
                "version": 1,
                "departments": [{"id": "legal", "name": "Legal"}],
                "laneHeights": {"legal": 120},
                "nodes": [
                    {"id": "start", "type": "START", "label": "Inicio", "departmentId": "legal", "x": 120, "y": 120},
                    {
                        "id": "task",
                        "type": "TASK",
                        "label": "Revisión legal",
                        "departmentId": "legal",
                        "x": 320,
                        "y": 120,
                        "config": {"taskType": "MANUAL", "estimatedTime": 12, "form": {"title": "Formulario", "fields": [{"id": "motivo", "type": "TEXT", "label": "Motivo", "required": True, "order": 1, "visibleToClient": False}]}},
                    },
                    {"id": "end", "type": "END", "label": "Fin", "departmentId": "legal", "x": 540, "y": 120},
                ],
                "connectors": [
                    {"id": "c1", "sourceId": "start", "targetId": "task", "type": "CONTROL_FLOW"},
                    {"id": "c2", "sourceId": "task", "targetId": "end", "type": "CONTROL_FLOW"},
                ],
            },
            "modelSource": "azure",
        }


class EmptyAssistantRuntime:
    def assistant(self, request: dict[str, object], simulation: dict[str, object]) -> dict[str, object]:
        return {
            "answer": "",
            "recommendations": [],
            "suggestedRules": {"version": 1, "departments": [], "laneHeights": {}, "nodes": [], "connectors": []},
            "modelSource": "azure",
        }


class RecordingAzureClient:
    def __init__(self, answer: str, suggested_rules: dict[str, object] | None = None) -> None:
        self.answer = answer
        self.suggested_rules = suggested_rules
        self.calls = 0

    @property
    def _configured(self) -> bool:
        return True

    def chat_json(self, system_prompt: str, user_payload: dict[str, object], *, temperature: float = 0.2) -> dict[str, object]:
        self.calls += 1
        response = {
            "answer": self.answer,
            "recommendations": ["Revisar coherencia del flujo."],
        }
        if self.suggested_rules is not None:
            response["suggestedRules"] = self.suggested_rules
        return response


class FailingAzureClient:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc

    @property
    def _configured(self) -> bool:
        return True

    def chat_json(self, system_prompt: str, user_payload: dict[str, object], *, temperature: float = 0.2) -> dict[str, object]:
        raise self.exc


class FailingTranscriber:
    def transcribe_base64(self, audio_base64: str) -> str:
        raise ValueError("max() arg is an empty sequence")


class AzureOpenAIClientTest(unittest.TestCase):
    def _mock_httpx_client(self, content: str) -> tuple[MagicMock, MagicMock]:
        response = MagicMock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"choices": [{"message": {"content": content}}]}

        client = MagicMock()
        client.post.return_value = response

        context_manager = MagicMock()
        context_manager.__enter__.return_value = client
        context_manager.__exit__.return_value = None
        return context_manager, client

    def test_classic_endpoint_uses_deployment_path(self) -> None:
        azure_client = AzureOpenAIClient(
            endpoint="https://example.openai.azure.com",
            deployment="demo-deployment",
            api_key="secret",
            api_version="2024-08-01-preview",
        )
        context_manager, client = self._mock_httpx_client('{"ok": true}')

        with patch("app.ai_runtime.httpx.Client", return_value=context_manager):
            result = azure_client.chat_json("system", {"hello": "world"})

        self.assertTrue(result["ok"])
        self.assertEqual(
            client.post.call_args.args[0],
            "https://example.openai.azure.com/openai/deployments/demo-deployment/chat/completions?api-version=2024-08-01-preview",
        )
        self.assertNotIn("model", client.post.call_args.kwargs["json"])

    def test_openai_v1_endpoint_uses_direct_chat_path(self) -> None:
        azure_client = AzureOpenAIClient(
            endpoint="  https://example.openai.azure.com/openai/v1/  ",
            deployment="demo-model",
            api_key="secret",
        )
        context_manager, client = self._mock_httpx_client('{"ok": true}')

        with patch("app.ai_runtime.httpx.Client", return_value=context_manager):
            result = azure_client.chat_json("system", {"hello": "world"})

        self.assertTrue(result["ok"])
        self.assertEqual(client.post.call_args.args[0], "https://example.openai.azure.com/openai/v1/chat/completions")
        self.assertEqual(client.post.call_args.kwargs["json"]["model"], "demo-model")


class NoopDlCore:
    def predict(self, text: str, history: object) -> dict[str, object]:
        raise AssertionError("predict should not be called for silent audio")


class DraftDlCore:
    def predict(self, text: str, history: object) -> dict[str, object]:
        return {
            "route": "LEGAL",
            "risk": "HIGH",
            "priority": "HIGH",
            "reportType": "operational-risk",
            "intent": "request",
            "confidence": 0.91,
        }


class FakeTensorFlowCore:
    def structured_intake(self, transcript: str, context: dict[str, object], policy_name: str | None) -> dict[str, object]:
        normalized = transcript.lower()
        route = "LEGAL" if "legal" in normalized else "GENERAL"
        intent = "request" if any(word in normalized for word in ["solicit", "necesit", "quier", "tramite", "consulta"]) else "statement"
        return {
            "structuredFields": {
                "intent": intent,
                "routeHint": route.lower(),
                "summary": transcript[:160],
                "policyName": policy_name,
                "contextSize": len(context),
            },
            "policyAssignment": policy_name or f"{route.lower()}-workflow",
            "suggestedNextAction": f"Assign {intent} to {route} workflow review.",
            "confidence": 0.93,
        }

    def report_generation(self, transcript: str, context: dict[str, object], policy_name: str | None) -> dict[str, object]:
        normalized = transcript.lower()
        report_type = "operational-risk" if any(word in normalized for word in ["demora", "riesgo", "bloqueo"]) else "document-trace" if any(word in normalized for word in ["documento", "firma", "evidencia"]) else "general-summary"
        title = f"TensorFlow draft - {policy_name or 'Política'}"
        body = "\n".join(
            [
                f"Summary: {transcript}",
                f"Suggested route: {'LEGAL' if 'legal' in normalized else 'GENERAL'}",
                f"Report type: {report_type}",
                f"Context keys: {sorted(context.keys())}" if context else "Context keys: []",
                "This draft was produced through the TensorFlow integration path.",
            ]
        )
        return {
            "title": title,
            "body": body,
            "reportType": report_type,
            "confidence": 0.96,
        }

    def analyst_prediction(self, request_text: str, history_summary: dict[str, object], anomalies: list[str]) -> dict[str, object]:
        normalized = request_text.lower()
        route = "LEGAL" if "legal" in normalized else "GENERAL"
        risk = "HIGH" if "demora" in normalized else "NORMAL"
        priority = "URGENT" if "urgente" in normalized else "HIGH" if risk == "HIGH" else "NORMAL"
        return {
            "route": route,
            "risk": risk,
            "priority": priority,
            "confidence": 0.94,
            "recommendedActions": ["Escalate review." if risk == "HIGH" else "Review workload."],
        }

    def form_assist(self, transcript: str, form_fields: list[dict[str, object]], context: dict[str, object], policy_name: str | None) -> dict[str, object]:
        suggestions: list[dict[str, object]] = []
        for field in form_fields:
            field_id = str(field.get("id") or "")
            if not field_id:
                continue
            if field_id != "motivo":
                continue
            suggestions.append(
                {
                    "fieldId": field_id,
                    "label": str(field.get("label") or field_id),
                    "type": str(field.get("type") or "SHORT_TEXT"),
                    "suggestedValue": str(context.get(field_id) or transcript),
                    "confidence": 0.92,
                    "source": "tensorflow",
                }
            )
        if context.get("clientName"):
            suggestions.append(
                {
                    "fieldId": "clientName",
                    "label": "clientName",
                    "type": "SHORT_TEXT",
                    "suggestedValue": context["clientName"],
                    "confidence": 0.95,
                    "source": "context",
                }
            )
        return {
            "suggestedFields": suggestions,
            "missingFields": [str(field.get("id") or "") for field in form_fields if field.get("required") and not context.get(field.get("id"))],
            "confidence": 0.91,
            "clarification": None,
        }


class NoopOllamaClient:
    def chat_json(self, system_prompt: str, user_payload: dict[str, object], *, temperature: float = 0.2) -> dict[str, object]:
        raise AssertionError("chat_json should not be called for silent audio")


class FailingOllamaClient:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc

    def chat_json(self, system_prompt: str, user_payload: dict[str, object], *, temperature: float = 0.2) -> dict[str, object]:
        raise self.exc


class RecordingOllamaClient:
    def __init__(self, response: dict[str, object]) -> None:
        self.response = response
        self.calls: list[dict[str, object]] = []

    def chat_json(
        self,
        system_prompt: str,
        user_payload: dict[str, object],
        *,
        temperature: float | None = None,
        num_ctx: int | None = None,
        num_predict: int | None = None,
        top_p: float | None = None,
        repeat_penalty: float | None = None,
    ) -> dict[str, object]:
        self.calls.append(
            {
                "system_prompt": system_prompt,
                "user_payload": user_payload,
                "temperature": temperature,
                "num_ctx": num_ctx,
                "num_predict": num_predict,
                "top_p": top_p,
                "repeat_penalty": repeat_penalty,
            }
        )
        return self.response


class AiServiceEndpointsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.warmup_patch = patch("app.main.warmup_ollama", return_value=None)
        self.warmup_mock = self.warmup_patch.start()
        self.client = TestClient(app)
        self.client.__enter__()
        self.runtime_patch = patch("app.main.get_ai_runtime", return_value=FakeAiRuntime())
        self.runtime_patch.start()

    def tearDown(self) -> None:
        self.client.__exit__(None, None, None)
        self.runtime_patch.stop()
        self.warmup_patch.stop()

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

    def test_voice_intake_uses_tensorflow_local_path_without_ollama(self) -> None:
        runtime = AICoreRuntime(
            ollama_client=FailingOllamaClient(RuntimeError("ollama offline")),
            dl_core=DraftDlCore(),
            tensor_core=FakeTensorFlowCore(),
        )

        result = runtime.voice_intake(
            {
                "text": "Necesito una revisión legal urgente",
                "policyName": "Política legal",
                "context": {"clientName": "Ana Pérez"},
            }
        )

        self.assertEqual(result["modelSource"], "tensorflow")
        self.assertEqual(result["structuredFields"]["intent"], "request")
        self.assertEqual(result["structuredFields"]["routeHint"], "legal")
        self.assertEqual(result["policyAssignment"], "Política legal")
        self.assertIn("LEGAL", result["suggestedNextAction"])

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
        self.assertEqual(body["modelSource"], "tensorflow")
        self.assertEqual(body["reportType"], "operational-risk")

    def test_report_draft_requests_clarification_when_input_is_missing(self) -> None:
        response = self.client.post("/reports/draft", json={})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("missingFields", body)
        self.assertTrue(body["missingFields"])
        self.assertIn("clarification", body)
        self.assertEqual(body["modelSource"], "heuristic")

    def test_form_assist_keeps_short_and_long_text_distinct(self) -> None:
        adapter = TensorFlowCoreAdapter()

        result = adapter.form_assist(
            "Resumen breve: autorización. Detalle: el trámite requiere revisión documental extensa, validación adicional y firma de supervisión antes de continuar.",
            [
                {"id": "resumen_corto", "label": "Resumen corto", "type": "SHORT_TEXT"},
                {"id": "detalle_largo", "label": "Detalle largo", "type": "LONG_TEXT"},
            ],
            {},
            None,
        )

        suggestions = {item["fieldId"]: item["suggestedValue"] for item in result["suggestedFields"]}
        self.assertIn("resumen_corto", suggestions)
        self.assertIn("detalle_largo", suggestions)
        self.assertNotEqual(suggestions["resumen_corto"], suggestions["detalle_largo"])
        self.assertLess(len(str(suggestions["resumen_corto"])), len(str(suggestions["detalle_largo"])))
        self.assertIn("documental", str(suggestions["detalle_largo"]).lower())

    def test_form_assist_preserves_matrix_headers_and_cells(self) -> None:
        adapter = TensorFlowCoreAdapter()

        result = adapter.form_assist(
            "Lunes: cantidad 10 y observación aprobado. Martes: cantidad 12 y observación pendiente.",
            [
                {
                    "id": "registro",
                    "label": "Registro semanal",
                    "type": "TABLE",
                    "matrixRows": ["Lunes", "Martes"],
                    "tableColumns": ["cantidad", "observación"],
                }
            ],
            {},
            None,
        )

        suggestion = next(item for item in result["suggestedFields"] if item["fieldId"] == "registro")
        rows = suggestion["suggestedValue"]
        self.assertIsInstance(rows, list)
        self.assertEqual(rows[0]["rowLabel"], "Lunes")
        self.assertEqual(rows[0]["cantidad"], "10")
        self.assertEqual(rows[0]["observación"], "Aprobado")
        self.assertEqual(rows[1]["rowLabel"], "Martes")
        self.assertEqual(rows[1]["cantidad"], "12")
        self.assertEqual(rows[1]["observación"], "Pendiente")

    def test_report_draft_stays_local_and_substantive_without_ollama_or_azure(self) -> None:
        runtime = AICoreRuntime(
            ollama_client=FailingOllamaClient(RuntimeError("ollama offline")),
            dl_core=DraftDlCore(),
            tensor_core=FakeTensorFlowCore(),
        )

        with patch("app.main.get_ai_runtime", return_value=runtime):
            response = self.client.post(
                "/reports/draft",
                json={
                    "text": "Generame un reporte de riesgo operativo sobre esta política.",
                    "policyName": "Política legal",
                    "context": {
                        "policyStatus": "En revisión",
                        "diagramContext": {"nodes": ["ingreso", "aprobacion"], "connectors": ["ingreso->aprobacion"]},
                        "rules": {"version": 2, "departments": ["legal"]},
                    },
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["modelSource"], "tensorflow")
        self.assertEqual(body["reportType"], "operational-risk")
        self.assertIn("Executive Summary", body["draftBody"])
        self.assertIn("Input Snapshot", body["draftBody"])
        self.assertIn("TensorFlow Base Draft", body["draftBody"])
        self.assertIn("Context Signals", body["draftBody"])
        self.assertIn("Next Steps", body["draftBody"])
        self.assertIn("En revisión", body["draftBody"])
        self.assertIn("aprobacion", body["draftBody"].lower())
        self.assertNotIn("Aclaración IA: ConnectError", body["draftBody"])
        self.assertIsNone(body["clarification"])
        self.assertFalse(body["missingFields"])
        self.assertTrue(body["recommendations"])

    def test_assistant_scales_suggested_rules_across_multiple_departments(self) -> None:
        runtime = AICoreRuntime(
            ollama_client=FailingOllamaClient(RuntimeError("ollama offline")),
            dl_core=DraftDlCore(),
            tensor_core=FakeTensorFlowCore(),
        )

        result = runtime.assistant(
            {
                "prompt": "Armar un flujo de revisión para varias áreas con validación final.",
                "policyName": "Política multidepartamental",
                "rules": {"version": 1, "departments": [], "nodes": [], "connectors": []},
                "history": [],
                "availableDepartments": [
                    {"id": "legal", "name": "Legal"},
                    {"id": "rrhh", "name": "RRHH"},
                    {"id": "auditoria", "name": "Auditoría"},
                    {"id": "soporte", "name": "Soporte"},
                ],
            },
            {"status": "warning", "errors": [], "warnings": ["Revisar validación"], "bottlenecks": [], "recommendations": []},
        )

        suggested_rules = result["suggestedRules"]
        self.assertEqual(result["modelSource"], "tensorflow")
        self.assertEqual(len(suggested_rules["departments"]), 4)
        self.assertEqual(len(suggested_rules["nodes"]), 7)
        self.assertEqual(len(suggested_rules["connectors"]), 6)
        self.assertTrue(all(dep["id"] in {"legal", "rrhh", "auditoria", "soporte"} for dep in suggested_rules["departments"]))
        self.assertIn("4 departamentos", " ".join(result["recommendations"]))

    def test_assistant_prefers_azure_for_text_and_keeps_structured_rules(self) -> None:
        azure_client = RecordingAzureClient(
            "Propuse una actualización del flujo.",
            {
                "version": 1,
                "departments": [
                    {"id": "legal", "name": "Legal"},
                    {"id": "it", "name": "IT"},
                    {"id": "operations", "name": "Operations"},
                ],
                "laneHeights": {"legal": 120, "it": 120, "operations": 120},
                "nodes": [
                    {"id": "start", "type": "START", "label": "Inicio", "departmentId": "legal", "x": 120, "y": 120},
                    {"id": "approval", "type": "TASK", "label": "Aprobación", "departmentId": "legal", "x": 320, "y": 120, "config": {"taskType": "APPROVAL", "estimatedTime": 12, "form": {"title": "Formulario", "fields": [{"id": "motivo", "type": "TEXT", "label": "Motivo", "required": True, "order": 1, "visibleToClient": False}]}}},
                    {"id": "end", "type": "END", "label": "Fin", "departmentId": "operations", "x": 540, "y": 120},
                ],
                "connectors": [
                    {"id": "c1", "sourceId": "start", "targetId": "approval", "type": "CONTROL_FLOW"},
                    {"id": "c2", "sourceId": "approval", "targetId": "end", "type": "CONTROL_FLOW"},
                ],
            },
        )
        runtime = AICoreRuntime(
            azure_client=azure_client,
            ollama_client=NoopOllamaClient(),
            dl_core=DraftDlCore(),
            tensor_core=FakeTensorFlowCore(),
        )

        result = runtime.assistant(
            {
                "prompt": "Armar un flujo de revisión para varias áreas con validación final.",
                "policyName": "Política multidepartamental",
                "rules": {"version": 1, "departments": [], "nodes": [], "connectors": []},
                "history": [],
                "availableDepartments": [
                    {"id": "legal", "name": "Legal"},
                    {"id": "rrhh", "name": "RRHH"},
                    {"id": "auditoria", "name": "Auditoría"},
                ],
            },
            {"status": "warning", "errors": [], "warnings": ["Revisar validación"], "bottlenecks": [], "recommendations": []},
        )

        self.assertEqual(azure_client.calls, 1)
        self.assertEqual(result["modelSource"], "azure")
        self.assertTrue(result["answer"].strip())
        self.assertNotRegex(result["answer"].lower(), r"tensorflow|ollama|azure")
        self.assertIn("flujo", result["answer"].lower())
        self.assertTrue(result["suggestedRules"]["nodes"])
        self.assertTrue(result["suggestedRules"]["connectors"])
        self.assertEqual(len(result["suggestedRules"]["departments"]), 3)
        self.assertEqual(len(result["suggestedRules"]["departments"]), 3)

    def test_assistant_rewrites_stale_runtime_answers_before_returning_them(self) -> None:
        runtime = StaleAssistantRuntime()

        with patch("app.main.get_ai_runtime", return_value=runtime):
            response = self.client.post(
                "/assistant",
                json={
                    "prompt": "Quiero crear un flujo nuevo para el departamento legal.",
                    "policyName": "Política legal",
                    "rules": {"version": 1, "departments": [], "nodes": [], "connectors": []},
                    "history": [],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["modelSource"], "azure")
        self.assertNotRegex(body["answer"].lower(), r"tensorflow|ollama|azure|openai|propuse un flujo local")
        self.assertIn("departamentos", body["answer"].lower())
        self.assertTrue(body["suggestedRules"]["nodes"])
        self.assertTrue(body["suggestedRules"]["connectors"])

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

    def test_assistant_uses_tensorflow_local_path_without_ollama(self) -> None:
        runtime = AICoreRuntime(
            azure_client=FailingAzureClient(RuntimeError("azure unavailable")),
            ollama_client=FailingOllamaClient(RuntimeError("ollama offline")),
            dl_core=DraftDlCore(),
            tensor_core=FakeTensorFlowCore(),
        )

        result = runtime.assistant(
            {
                "prompt": "Quiero crear un flujo nuevo para el departamento legal.",
                "policyName": "Política legal",
                "rules": {"version": 1, "departments": [], "nodes": [], "connectors": []},
                "history": [],
                "availableDepartments": [{"id": "legal", "name": "Legal"}],
                "boardContract": {},
            },
            {"status": "warning", "errors": [], "warnings": ["Revisar validación"], "bottlenecks": [], "recommendations": []},
        )

        self.assertEqual(result["modelSource"], "tensorflow")
        self.assertTrue(result["suggestedRules"]["nodes"])
        self.assertTrue(result["suggestedRules"]["connectors"])
        self.assertEqual(result["suggestedRules"]["nodes"][0]["type"], "START")
        self.assertEqual(result["suggestedRules"]["nodes"][-1]["type"], "END")
        self.assertIn("legal", str(result["suggestedRules"]).lower())
        self.assertNotRegex(result["answer"].lower(), r"tensorflow|ollama|azure")

    def test_assistant_endpoint_adds_approval_and_legal_steps_when_runtime_returns_no_change(self) -> None:
        runtime = EmptyAssistantRuntime()

        with patch("app.main.get_ai_runtime", return_value=runtime):
            response = self.client.post(
                "/assistant",
                json={
                    "prompt": "Add an approval task, then legal info after approval, and include IT, Legal, Operations in the flow.",
                    "policyName": "Policy flow",
                    "rules": {
                        "version": 1,
                        "departments": [{"id": "legal", "name": "Legal"}],
                        "laneHeights": {"legal": 120},
                        "nodes": [
                            {"id": "start", "type": "START", "label": "Inicio", "departmentId": "legal", "x": 120, "y": 120},
                            {
                                "id": "task",
                                "type": "TASK",
                                "label": "Revisión legal",
                                "departmentId": "legal",
                                "x": 320,
                                "y": 120,
                                "config": {"taskType": "REVISION", "estimatedTime": 12, "form": {"title": "Formulario", "fields": [{"id": "motivo", "type": "TEXT", "label": "Motivo", "required": True, "order": 1, "visibleToClient": False}]}},
                            },
                            {"id": "end", "type": "END", "label": "Fin", "departmentId": "legal", "x": 540, "y": 120},
                        ],
                        "connectors": [
                            {"id": "c1", "sourceId": "start", "targetId": "task", "type": "CONTROL_FLOW"},
                            {"id": "c2", "sourceId": "task", "targetId": "end", "type": "CONTROL_FLOW"},
                        ],
                    },
                    "history": [],
                    "availableDepartments": [
                        {"id": "it", "name": "IT"},
                        {"id": "legal", "name": "Legal"},
                        {"id": "operations", "name": "Operations"},
                    ],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["modelSource"], "heuristic")
        self.assertNotRegex(body["answer"].lower(), r"tensorflow|ollama|azure|openai")
        self.assertTrue(body["suggestedRules"]["nodes"])
        labels = " ".join(node.get("label", "") for node in body["suggestedRules"]["nodes"])
        self.assertIn("aprob", labels.lower())
        self.assertIn("legal", labels.lower())
        self.assertEqual({dept["id"] for dept in body["suggestedRules"]["departments"]}, {"legal", "it", "operations"})

    def test_assistant_endpoint_handles_legal_data_collection_as_a_distinct_step(self) -> None:
        runtime = EmptyAssistantRuntime()

        with patch("app.main.get_ai_runtime", return_value=runtime):
            response = self.client.post(
                "/assistant",
                json={
                    "prompt": "Seguido de la aprobación IT, agregá una tarea para el departamento legal que sea recopilación de datos legal.",
                    "policyName": "Policy flow",
                    "rules": {
                        "version": 1,
                        "departments": [{"id": "it", "name": "IT"}, {"id": "legal", "name": "Legal"}],
                        "laneHeights": {"it": 120, "legal": 120},
                        "nodes": [
                            {"id": "start", "type": "START", "label": "Inicio", "departmentId": "it", "x": 120, "y": 120},
                            {
                                "id": "approval",
                                "type": "TASK",
                                "label": "Aprobación IT",
                                "departmentId": "it",
                                "x": 320,
                                "y": 120,
                                "config": {"taskType": "APPROVAL", "estimatedTime": 12, "form": {"title": "Formulario", "fields": [{"id": "motivo", "type": "TEXT", "label": "Motivo", "required": True, "order": 1, "visibleToClient": False}]}},
                            },
                            {"id": "end", "type": "END", "label": "Fin", "departmentId": "legal", "x": 540, "y": 120},
                        ],
                        "connectors": [
                            {"id": "c1", "sourceId": "start", "targetId": "approval", "type": "CONTROL_FLOW"},
                            {"id": "c2", "sourceId": "approval", "targetId": "end", "type": "CONTROL_FLOW"},
                        ],
                    },
                    "history": [],
                    "availableDepartments": [
                        {"id": "it", "name": "IT"},
                        {"id": "legal", "name": "Legal"},
                        {"id": "operations", "name": "Operations"},
                    ],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["suggestedRules"]["nodes"])
        labels = [node.get("label", "") for node in body["suggestedRules"]["nodes"]]
        self.assertTrue(any("recop" in label.lower() for label in labels))
        self.assertTrue(any(node.get("departmentId") == "legal" for node in body["suggestedRules"]["nodes"]))
        self.assertNotRegex(body["answer"].lower(), r"tensorflow|ollama|azure|openai")

    def test_form_assist_uses_tensorflow_local_path_without_ollama(self) -> None:
        runtime = AICoreRuntime(
            ollama_client=FailingOllamaClient(RuntimeError("ollama offline")),
            dl_core=DraftDlCore(),
            tensor_core=FakeTensorFlowCore(),
        )

        result = runtime.form_assist(
            {
                "text": "Solicito revisión legal urgente y confirmo la firma requerida.",
                "policyName": "Política legal",
                "context": {"clientName": "Ana Pérez"},
                "formFields": [
                    {"id": "motivo", "label": "Motivo", "type": "LONG_TEXT", "required": True},
                    {"id": "confirmacion", "label": "Confirmación", "type": "CHECKBOX", "required": True},
                ],
            }
        )

        self.assertEqual(result["modelSource"], "tensorflow")
        self.assertTrue(result["suggestedFields"])
        self.assertIn("motivo", [field["fieldId"] for field in result["suggestedFields"]])
        self.assertIn("clientName", [field["fieldId"] for field in result["suggestedFields"]])
        self.assertTrue(result["missingFields"])
        self.assertIn("confirmacion", result["missingFields"])

    def test_form_assist_distinguishes_short_and_long_description_suggestions(self) -> None:
        runtime = AICoreRuntime(
            ollama_client=FailingOllamaClient(RuntimeError("ollama offline")),
            dl_core=DraftDlCore(),
            tensor_core=TensorFlowCoreAdapter(),
        )

        result = runtime.form_assist(
            {
                "text": "Solicito reembolso. Detalle: el expediente incluye facturas, fechas y una nota adicional sobre el desvío de fondos.",
                "formFields": [
                    {"id": "resumen_corto", "label": "Resumen breve", "type": "SHORT_TEXT", "required": True},
                    {"id": "detalle_extenso", "label": "Detalle extenso", "type": "LONG_TEXT", "required": True},
                ],
            }
        )

        suggestions = {field["fieldId"]: field["suggestedValue"] for field in result["suggestedFields"]}
        self.assertIn("resumen_corto", suggestions)
        self.assertIn("detalle_extenso", suggestions)
        self.assertNotEqual(suggestions["resumen_corto"], suggestions["detalle_extenso"])
        self.assertLess(len(str(suggestions["resumen_corto"])), len(str(suggestions["detalle_extenso"])))
        self.assertIn("facturas", str(suggestions["detalle_extenso"]).lower())

    def test_form_assist_populates_matrix_grid_fields_with_contextual_cues(self) -> None:
        runtime = AICoreRuntime(
            ollama_client=FailingOllamaClient(RuntimeError("ollama offline")),
            dl_core=DraftDlCore(),
            tensor_core=TensorFlowCoreAdapter(),
        )

        result = runtime.form_assist(
            {
                "text": "En la fila Estado, columna Aprobado marcar si. En la fila Observaciones, columna Comentario dejar pendiente.",
                "formFields": [
                    {
                        "id": "matriz_revision",
                        "label": "Matriz de revisión",
                        "type": "TABLE",
                        "required": True,
                        "matrixRows": ["Estado", "Observaciones"],
                        "tableColumns": ["Aprobado", "Comentario"],
                    }
                ],
            }
        )

        self.assertTrue(result["suggestedFields"])
        matrix_field = next(field for field in result["suggestedFields"] if field["fieldId"] == "matriz_revision")
        self.assertIsInstance(matrix_field["suggestedValue"], list)
        self.assertEqual(matrix_field["suggestedValue"][0]["rowLabel"], "Estado")
        self.assertEqual(matrix_field["suggestedValue"][0]["Aprobado"], "Sí")
        self.assertEqual(matrix_field["suggestedValue"][1]["rowLabel"], "Observaciones")
        self.assertEqual(matrix_field["suggestedValue"][1]["Comentario"], "Pendiente")

    def test_assistant_filters_invalid_suggested_rules_before_returning_them(self) -> None:
        response = self.client.post(
            "/assistant",
            json={
                "prompt": "Quiero que crees un flujo en el departamento legal.",
                "policyName": "Política legal",
                "rules": {"version": 1, "departments": [], "nodes": [], "connectors": []},
                "history": [],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["answer"].strip())
        self.assertEqual(body["modelSource"], "heuristic")

    def test_assistant_falls_back_when_runtime_fails(self) -> None:
        with patch("app.main.get_ai_runtime", return_value=FailingAssistantRuntime()):
            response = self.client.post(
                "/assistant",
                json={
                    "prompt": "Quiero crear un flujo nuevo para el departamento legal.",
                    "policyName": "Política legal",
                    "rules": {"version": 1, "departments": [], "nodes": [], "connectors": []},
                    "history": [],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["answer"].strip())
        self.assertTrue(body["recommendations"])
        self.assertEqual(body["modelSource"], "heuristic")

    def test_assistant_uses_tensorflow_even_when_ollama_fails(self) -> None:
        ollama_request = httpx.Request("POST", "http://ollama:11434/api/chat")
        failures = [
            httpx.HTTPStatusError("Server error", request=ollama_request, response=httpx.Response(500, request=ollama_request)),
            httpx.RemoteProtocolError("Server disconnected without sending a response."),
        ]

        for failure in failures:
            runtime = AICoreRuntime(ollama_client=FailingOllamaClient(failure), dl_core=DraftDlCore())
            with patch("app.main.get_ai_runtime", return_value=runtime):
                response = self.client.post(
                    "/assistant",
                    json={
                        "prompt": "Quiero crear un flujo nuevo para el departamento legal.",
                        "policyName": "Política legal",
                        "rules": {"version": 1, "departments": [], "nodes": [], "connectors": []},
                        "history": [],
                    },
                )

            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertTrue(body["answer"].strip())
            self.assertTrue(body["recommendations"])
            self.assertEqual(body["modelSource"], "tensorflow")
            self.assertTrue(body["suggestedRules"]["nodes"])
            self.assertIn("nodos", body["answer"].lower())

    def test_ai_runtime_preserves_ollama_timeout_for_slow_local_runs(self) -> None:
        runtime = AICoreRuntime(ollama_client=OllamaClient(timeout_seconds=600), dl_core=DraftDlCore())

        self.assertEqual(runtime.ollama_client.timeout_seconds, 600)

    def test_startup_triggers_ollama_warmup(self) -> None:
        self.warmup_mock.assert_called_once()

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

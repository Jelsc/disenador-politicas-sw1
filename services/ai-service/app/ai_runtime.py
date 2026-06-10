from __future__ import annotations

import base64
import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx


try:
    import tensorflow as tf
except Exception as exc:  # pragma: no cover - imported during runtime
    tf = None
    _tensorflow_import_error = exc
else:
    _tensorflow_import_error = None


try:
    from faster_whisper import WhisperModel
except Exception:  # pragma: no cover - optional at import time for tests
    WhisperModel = None


OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
TF_MODEL_PATH = Path(os.getenv("AI_CORE_MODEL_PATH", "/app/models/ai-core.keras"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")


ROUTE_LABELS = ["GENERAL", "LEGAL", "FINANCIERO", "ATENCION", "SOPORTE", "RRHH"]
RISK_LABELS = ["LOW", "NORMAL", "HIGH"]
PRIORITY_LABELS = ["LOW", "NORMAL", "HIGH", "URGENT"]
REPORT_LABELS = ["general-summary", "operational-risk", "document-trace"]
INTENT_LABELS = ["statement", "request"]


@dataclass(frozen=True)
class HistorySummary:
    sample_size: int
    avg_queue: float
    avg_duration: float
    avg_rework: float
    avg_signature_wait: float
    anomaly_score: float

    def as_features(self) -> list[float]:
        return [
            float(self.sample_size),
            float(self.avg_queue),
            float(self.avg_duration),
            float(self.avg_rework),
            float(self.avg_signature_wait),
            float(self.anomaly_score),
        ]


class OllamaClient:
    def __init__(self, base_url: str = OLLAMA_URL, model: str = OLLAMA_MODEL, timeout_seconds: float = OLLAMA_TIMEOUT_SECONDS) -> None:
        self.base_url = base_url
        self.model = model
        self.timeout_seconds = timeout_seconds

    def chat_json(self, system_prompt: str, user_payload: dict[str, Any], *, temperature: float = 0.2) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "options": {"temperature": temperature, "num_ctx": 4096},
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                    ],
                },
            )
            response.raise_for_status()

        content = response.json().get("message", {}).get("content", "")
        return self._parse_json(content)

    def _parse_json(self, content: str) -> dict[str, Any]:
        text = content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE | re.DOTALL)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, flags=re.DOTALL)
            if match:
                return json.loads(match.group(0))
            raise


class WhisperTranscriber:
    def __init__(self, model_name: str = WHISPER_MODEL, device: str = WHISPER_DEVICE, compute_type: str = WHISPER_COMPUTE_TYPE) -> None:
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self._model = None

    def transcribe_base64(self, audio_base64: str) -> str:
        if not audio_base64:
            return ""
        if WhisperModel is None:
            raise RuntimeError("faster-whisper is not installed")

        try:
            raw = base64.b64decode(audio_base64, validate=True)
        except Exception:
            return ""
        if not raw:
            return ""

        model = self._load_model()
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as temp_file:
                temp_file.write(raw)
                temp_path = temp_file.name

            try:
                segments, _info = model.transcribe(temp_path, beam_size=1, vad_filter=True)
            except Exception:
                return ""
            transcript = " ".join(segment.text.strip() for segment in segments).strip()
            return transcript
        finally:
            if temp_path:
                try:
                    Path(temp_path).unlink(missing_ok=True)
                except Exception:
                    pass

    def _load_model(self):
        if self._model is None:
            self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        return self._model


class DeepLearningCore:
    def __init__(self, model_path: Path = TF_MODEL_PATH) -> None:
        if tf is None:
            raise RuntimeError(f"TensorFlow is unavailable: {_tensorflow_import_error}")
        self.model_path = model_path
        self._model = None

    @property
    def model(self):
        if self._model is None:
            if self.model_path.exists():
                self._model = tf.keras.models.load_model(self.model_path)
            else:
                self.model_path.parent.mkdir(parents=True, exist_ok=True)
                self._model = self._train_and_save()
        return self._model

    def predict(self, text: str, history: HistorySummary) -> dict[str, Any]:
        outputs = self.model.predict(
            {
                "text": tf.constant([text]),
                "features": tf.constant([history.as_features()], dtype=tf.float32),
            },
            verbose=0,
        )
        route_scores = outputs["route"][0]
        risk_scores = outputs["risk"][0]
        priority_scores = outputs["priority"][0]
        report_scores = outputs["report_type"][0]
        intent_scores = outputs["intent"][0]
        return {
            "route": ROUTE_LABELS[self._argmax(route_scores)],
            "risk": RISK_LABELS[self._argmax(risk_scores)],
            "priority": PRIORITY_LABELS[self._argmax(priority_scores)],
            "reportType": REPORT_LABELS[self._argmax(report_scores)],
            "intent": INTENT_LABELS[self._argmax(intent_scores)],
            "confidence": float(max(self._max_value(route_scores), self._max_value(risk_scores), self._max_value(priority_scores))),
        }

    def _argmax(self, values: Any) -> int:
        return max(range(len(values)), key=lambda i: float(values[i]))

    def _max_value(self, values: Any) -> float:
        return float(max(float(value) for value in values))

    def _train_and_save(self):
        samples = _training_samples()
        texts = tf.constant([sample["text"] for sample in samples])
        features = tf.constant([sample["features"] for sample in samples], dtype=tf.float32)

        y = {
            "route": tf.keras.utils.to_categorical([ROUTE_LABELS.index(sample["route"]) for sample in samples], num_classes=len(ROUTE_LABELS)),
            "risk": tf.keras.utils.to_categorical([RISK_LABELS.index(sample["risk"]) for sample in samples], num_classes=len(RISK_LABELS)),
            "priority": tf.keras.utils.to_categorical([PRIORITY_LABELS.index(sample["priority"]) for sample in samples], num_classes=len(PRIORITY_LABELS)),
            "report_type": tf.keras.utils.to_categorical([REPORT_LABELS.index(sample["reportType"]) for sample in samples], num_classes=len(REPORT_LABELS)),
            "intent": tf.keras.utils.to_categorical([INTENT_LABELS.index(sample["intent"]) for sample in samples], num_classes=len(INTENT_LABELS)),
        }

        vectorizer = tf.keras.layers.TextVectorization(
            standardize="lower_and_strip_punctuation",
            max_tokens=2500,
            output_mode="int",
            output_sequence_length=48,
            name="text_vectorizer",
        )
        vectorizer.adapt(texts)

        text_input = tf.keras.Input(shape=(1,), dtype=tf.string, name="text")
        features_input = tf.keras.Input(shape=(6,), dtype=tf.float32, name="features")
        x_text = vectorizer(text_input)
        x_text = tf.keras.layers.Embedding(2500, 32)(x_text)
        x_text = tf.keras.layers.GlobalAveragePooling1D()(x_text)
        x = tf.keras.layers.Concatenate()([x_text, features_input])
        x = tf.keras.layers.Dense(64, activation="relu")(x)
        x = tf.keras.layers.Dropout(0.15)(x)
        x = tf.keras.layers.Dense(32, activation="relu")(x)

        outputs = {
            "route": tf.keras.layers.Dense(len(ROUTE_LABELS), activation="softmax", name="route")(x),
            "risk": tf.keras.layers.Dense(len(RISK_LABELS), activation="softmax", name="risk")(x),
            "priority": tf.keras.layers.Dense(len(PRIORITY_LABELS), activation="softmax", name="priority")(x),
            "report_type": tf.keras.layers.Dense(len(REPORT_LABELS), activation="softmax", name="report_type")(x),
            "intent": tf.keras.layers.Dense(len(INTENT_LABELS), activation="softmax", name="intent")(x),
        }

        model = tf.keras.Model(inputs={"text": text_input, "features": features_input}, outputs=outputs)
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.003),
            loss={name: "categorical_crossentropy" for name in outputs},
            metrics={name: ["accuracy"] for name in outputs},
        )

        model.fit(
            {"text": texts, "features": features},
            y,
            epochs=12,
            batch_size=4,
            verbose=0,
        )
        model.save(self.model_path)
        return model


class AICoreRuntime:
    def __init__(self, ollama_client: OllamaClient | None = None, dl_core: DeepLearningCore | None = None, transcriber: WhisperTranscriber | None = None) -> None:
        self.ollama_client = ollama_client or OllamaClient()
        if hasattr(self.ollama_client, "timeout_seconds"):
            self.ollama_client.timeout_seconds = min(float(getattr(self.ollama_client, "timeout_seconds", 45.0)), 45.0)
        self.dl_core = dl_core or DeepLearningCore()
        self.transcriber = transcriber or WhisperTranscriber()

    def assistant(self, request: dict[str, Any], simulation: dict[str, Any]) -> dict[str, Any]:
        system_prompt = (
            "Sos un asistente experto en diseño de trámites públicos, flujos operativos y formularios. "
            "Respondé en español claro y devolvé JSON estricto con esta forma: "
            '{"answer": string, "recommendations": string[], "suggestedRules": object|null}. '
            "No inventes departamentos ni pasos fuera del contexto. "
            "Si proponés suggestedRules, devolvé una snapshot completa y conectada que cumpla el contrato del tablero. "
            "No dejes TASKs sin departmentId, taskType, estimatedTime ni formulario operativo. "
            "No dejes GATEWAYs sin evaluatedField, branches, defaultBranch ni dos salidas como mínimo. "
            "No crees conectores hacia ids que no existan."
        )
        payload = {
            "policyName": request.get("policyName"),
            "prompt": request.get("prompt"),
            "rules": request.get("rules") or {},
            "history": request.get("history") or [],
            "simulation": simulation,
            "boardContract": request.get("boardContract") or {},
        }
        try:
            data = self.ollama_client.chat_json(system_prompt, payload)
            answer = str(data.get("answer") or "").strip()
            if not answer:
                raise ValueError("empty assistant answer")
            return {
                "answer": answer,
                "recommendations": [str(item).strip() for item in data.get("recommendations", []) if str(item).strip()],
                "suggestedRules": data.get("suggestedRules"),
                "modelSource": "ollama",
            }
        except Exception as exc:
            return {
                "answer": "Ollama no respondió correctamente, así que devolví una respuesta heurística segura.",
                "recommendations": [
                    "Reintentá la consulta cuando el modelo esté disponible.",
                    f"Detalle técnico: {type(exc).__name__}",
                ],
                "suggestedRules": None,
                "modelSource": "heuristic",
            }

    def voice_intake(self, request: dict[str, Any]) -> dict[str, Any]:
        transcript = self._resolve_transcript(request.get("text"), request.get("audioBase64"))
        if not transcript:
            return {
                "transcript": "",
                "source": "empty",
                "confidence": 0.0,
                "modelSource": "tensorflow",
                "structuredFields": {},
                "policyAssignment": request.get("policyName"),
                "suggestedNextAction": "Provide text or audio to analyze.",
            }
        history = HistorySummary(sample_size=0, avg_queue=0.0, avg_duration=0.0, avg_rework=0.0, avg_signature_wait=0.0, anomaly_score=0.0)
        predictions = self.dl_core.predict(transcript, history)
        payload = {
            "transcript": transcript,
            "policyName": request.get("policyName"),
            "context": request.get("context") or {},
            "predictions": predictions,
            "instruction": "Return JSON with structuredFields, policyAssignment, suggestedNextAction, and confidence.",
        }
        data = self.ollama_client.chat_json(
            "Sos un extractor de trámites. Devolvé JSON estricto y priorizá los datos estructurados.",
            payload,
        )
        structured_fields = data.get("structuredFields") if isinstance(data.get("structuredFields"), dict) else {}
        structured_fields.setdefault("intent", predictions["intent"])
        structured_fields.setdefault("routeHint", predictions["route"].lower())
        structured_fields.setdefault("summary", transcript[:160])
        policy_assignment = data.get("policyAssignment")
        if not isinstance(policy_assignment, str) or not policy_assignment.strip():
            policy_assignment = request.get("policyName") or f"{predictions['route'].lower()}-policy-candidate"
        suggested_next_action = data.get("suggestedNextAction")
        if not isinstance(suggested_next_action, str) or not suggested_next_action.strip():
            suggested_next_action = f"Route to {predictions['route']} workflow review."
        return {
            "transcript": transcript,
            "source": "audio" if request.get("audioBase64") else "text",
            "confidence": float(data.get("confidence") or predictions["confidence"]),
            "modelSource": "tensorflow",
            "structuredFields": structured_fields,
            "policyAssignment": policy_assignment,
            "suggestedNextAction": suggested_next_action,
        }

    def analyst_insights(self, request: dict[str, Any]) -> dict[str, Any]:
        history = self._summarize_history(request.get("history") or [])
        predictions = self.dl_core.predict(request.get("requestText") or "", history)
        payload = {
            "requestText": request.get("requestText"),
            "policyName": request.get("policyName"),
            "history": request.get("history") or [],
            "historySummary": history.__dict__,
            "predictions": predictions,
        }
        data = self.ollama_client.chat_json(
            "Sos un analista de trámites. Devolvé JSON estricto con route, risk, priority, anomalies, confidence, summary y recommendedActions.",
            payload,
        )
        return {
            "route": data.get("route") if isinstance(data.get("route"), str) and data.get("route").strip() else predictions["route"],
            "risk": data.get("risk") if isinstance(data.get("risk"), str) and data.get("risk").strip() else predictions["risk"],
            "priority": data.get("priority") if isinstance(data.get("priority"), str) and data.get("priority").strip() else predictions["priority"],
            "anomalies": [self._normalize_llm_list_item(item) for item in (data.get("anomalies") if isinstance(data.get("anomalies"), list) else []) if self._normalize_llm_list_item(item)],
            "confidence": float(data.get("confidence") or predictions["confidence"]),
            "summary": str(data.get("summary") or "").strip() or f"Route {predictions['route']}; risk {predictions['risk']}; priority {predictions['priority']}.",
            "modelSource": "tensorflow",
            "recommendedActions": [self._normalize_llm_list_item(item) for item in (data.get("recommendedActions") if isinstance(data.get("recommendedActions"), list) else []) if self._normalize_llm_list_item(item)],
        }

    def report_draft(self, request: dict[str, Any]) -> dict[str, Any]:
        transcript = self._resolve_transcript(request.get("text") or request.get("transcript"), request.get("audioBase64"))
        if not transcript:
            return {
                "draftTitle": "",
                "draftBody": "",
                "missingFields": ["text_or_audio"],
                "clarification": "Necesito texto o audio para redactar el informe.",
                "confidence": 0.0,
                "modelSource": "ollama",
                "reportType": None,
            }
        history = self._summarize_history([])
        predictions = self.dl_core.predict(transcript, history)
        payload = {
            "transcript": transcript,
            "policyName": request.get("policyName"),
            "context": request.get("context") or {},
            "predictions": predictions,
            "instruction": "Return JSON strict with draftTitle, draftBody, missingFields, clarification, confidence, reportType.",
        }
        data = self.ollama_client.chat_json(
            "Sos un redactor de informes. Devolvé JSON estricto y no agregues texto fuera del esquema.",
            payload,
        )
        return {
            "draftTitle": str(data.get("draftTitle") if isinstance(data.get("draftTitle"), str) and data.get("draftTitle").strip() else f"Borrador de reporte - {request.get('policyName') or predictions['route']}").strip(),
            "draftBody": str(data.get("draftBody") if isinstance(data.get("draftBody"), str) and data.get("draftBody").strip() else transcript).strip(),
            "missingFields": [str(item) for item in (data.get("missingFields") if isinstance(data.get("missingFields"), list) else []) if str(item).strip()],
            "clarification": data.get("clarification") if isinstance(data.get("clarification"), str) or data.get("clarification") is None else None,
            "confidence": float(data.get("confidence") or predictions["confidence"]),
            "modelSource": "ollama",
            "reportType": str(data.get("reportType") if isinstance(data.get("reportType"), str) and data.get("reportType").strip() else predictions["reportType"]),
        }

    def form_assist(self, request: dict[str, Any]) -> dict[str, Any]:
        transcript = self._resolve_transcript(request.get("text"), request.get("audioBase64"))
        if not transcript:
            return {
                "transcript": "",
                "source": "empty",
                "confidence": 0.0,
                "modelSource": "ollama",
                "suggestedFields": [],
                "missingFields": ["text_or_audio"],
                "clarification": "Necesito texto o audio para interpretar el formulario.",
            }
        history = self._summarize_history([])
        predictions = self.dl_core.predict(transcript, history)
        payload = {
            "transcript": transcript,
            "policyName": request.get("policyName"),
            "context": request.get("context") or {},
            "formFields": request.get("formFields") or [],
            "predictions": predictions,
            "instruction": "Return JSON strict with suggestedFields, missingFields and clarification.",
        }
        data = self.ollama_client.chat_json(
            "Sos un asistente de formulario. Devolvé JSON estricto con campos sugeridos y faltantes.",
            payload,
        )
        suggested_fields_raw = data.get("suggestedFields") if isinstance(data.get("suggestedFields"), list) else []
        normalized_suggested_fields: list[dict[str, Any]] = []
        for item in suggested_fields_raw:
            if not isinstance(item, dict):
                continue
            field_id = str(item.get("fieldId") or item.get("id") or item.get("name") or "").strip()
            label = str(item.get("label") or field_id or "Field").strip()
            field_type = str(item.get("type") or "SHORT_TEXT").upper()
            suggested_value = item.get("suggestedValue")
            if suggested_value is None or (isinstance(suggested_value, str) and not suggested_value.strip()):
                suggested_value = label
            normalized_suggested_fields.append(
                {
                    "fieldId": field_id or label,
                    "label": label,
                    "type": field_type,
                    "suggestedValue": suggested_value,
                    "confidence": float(item.get("confidence") or 0.8),
                    "source": str(item.get("source") or "ollama"),
                }
            )
        missing_fields_raw = data.get("missingFields") if isinstance(data.get("missingFields"), list) else []
        normalized_missing_fields: list[str] = []
        for item in missing_fields_raw:
            if isinstance(item, dict):
                field_id = str(item.get("fieldId") or item.get("id") or item.get("name") or "").strip()
                if field_id:
                    normalized_missing_fields.append(field_id)
                    continue
            text = self._normalize_llm_list_item(item)
            if text:
                normalized_missing_fields.append(text)
        return {
            "transcript": transcript,
            "source": "audio" if request.get("audioBase64") else "text",
            "confidence": float(data.get("confidence") or predictions["confidence"]),
            "modelSource": "ollama",
            "suggestedFields": normalized_suggested_fields,
            "missingFields": normalized_missing_fields,
            "clarification": data.get("clarification") if isinstance(data.get("clarification"), str) or data.get("clarification") is None else None,
        }

    def _resolve_transcript(self, text: str | None, audio_base64: str | None) -> str:
        if text and str(text).strip():
            return str(text).strip()
        if audio_base64:
            try:
                return self.transcriber.transcribe_base64(audio_base64).strip()
            except Exception:
                return ""
        return ""

    def _summarize_history(self, history: list[dict[str, Any]]) -> HistorySummary:
        if not history:
            return HistorySummary(0, 0.0, 0.0, 0.0, 0.0, 0.0)

        sample_size = len(history)
        avg_queue = sum(float(event.get("queueSize") or 0) for event in history) / sample_size
        avg_duration = sum(float(event.get("durationHours") or 0) for event in history) / sample_size
        avg_rework = sum(float(event.get("reworkCount") or 0) for event in history) / sample_size
        avg_signature_wait = sum(float(event.get("waitingSignatureHours") or 0) for event in history) / sample_size
        anomaly_score = min(1.0, (avg_queue / 10.0) * 0.35 + (avg_rework / 5.0) * 0.35 + (avg_signature_wait / 24.0) * 0.3)
        return HistorySummary(sample_size, avg_queue, avg_duration, avg_rework, avg_signature_wait, anomaly_score)

    def _normalize_llm_list_item(self, item: Any) -> str:
        if isinstance(item, str):
            return item.strip()
        if isinstance(item, dict):
            parts = []
            if item.get("action"):
                parts.append(str(item["action"]).strip())
            if item.get("description"):
                parts.append(str(item["description"]).strip())
            if parts:
                return " - ".join(parts)
        text = str(item).strip()
        return text if text and text != "{}" else ""


_runtime: AICoreRuntime | None = None


def get_ai_runtime() -> AICoreRuntime:
    global _runtime
    if _runtime is None:
        _runtime = AICoreRuntime()
    return _runtime


def _training_samples() -> list[dict[str, Any]]:
    return [
        {"text": "Solicitud legal urgente con firma pendiente y revisión de normativa.", "features": [1, 4, 8, 2, 6, 0.62], "route": "LEGAL", "risk": "HIGH", "priority": "URGENT", "reportType": "operational-risk", "intent": "request"},
        {"text": "Consulta de cliente sobre reclamo y seguimiento de expediente.", "features": [1, 2, 3, 0, 1, 0.22], "route": "ATENCION", "risk": "NORMAL", "priority": "NORMAL", "reportType": "general-summary", "intent": "request"},
        {"text": "Problema técnico con error en el sistema y bloqueo de carga.", "features": [1, 6, 7, 2, 0, 0.38], "route": "SOPORTE", "risk": "HIGH", "priority": "HIGH", "reportType": "operational-risk", "intent": "request"},
        {"text": "Solicitud de licencia de personal con verificación de recursos humanos.", "features": [1, 1, 2, 0, 0, 0.15], "route": "RRHH", "risk": "LOW", "priority": "NORMAL", "reportType": "general-summary", "intent": "request"},
        {"text": "Trámite financiero con factura, presupuesto y cobro pendiente.", "features": [1, 5, 6, 1, 4, 0.45], "route": "FINANCIERO", "risk": "HIGH", "priority": "HIGH", "reportType": "document-trace", "intent": "request"},
        {"text": "Registro general de expediente sin urgencia y sin observaciones.", "features": [1, 0, 1, 0, 0, 0.05], "route": "GENERAL", "risk": "LOW", "priority": "LOW", "reportType": "general-summary", "intent": "statement"},
        {"text": "Informe legal con evidencia documental y revisión de contrato.", "features": [2, 3, 4, 1, 2, 0.25], "route": "LEGAL", "risk": "NORMAL", "priority": "NORMAL", "reportType": "document-trace", "intent": "statement"},
        {"text": "Seguimiento operativo con demora y re-trabajo en varias tareas.", "features": [4, 7, 9, 4, 8, 0.71], "route": "GENERAL", "risk": "HIGH", "priority": "HIGH", "reportType": "operational-risk", "intent": "request"},
        {"text": "Consulta de documentos y firma de cliente para archivo.", "features": [2, 2, 3, 0, 5, 0.24], "route": "ATENCION", "risk": "NORMAL", "priority": "NORMAL", "reportType": "document-trace", "intent": "request"},
        {"text": "Incidente de soporte con error crítico y cola alta.", "features": [5, 8, 10, 3, 1, 0.83], "route": "SOPORTE", "risk": "HIGH", "priority": "URGENT", "reportType": "operational-risk", "intent": "request"},
        {"text": "Actualización de expediente financiero con recibo y documento adjunto.", "features": [2, 3, 4, 1, 1, 0.3], "route": "FINANCIERO", "risk": "NORMAL", "priority": "NORMAL", "reportType": "document-trace", "intent": "statement"},
        {"text": "Solicitud simple sin urgencia para revisión general.", "features": [1, 0, 1, 0, 0, 0.02], "route": "GENERAL", "risk": "LOW", "priority": "LOW", "reportType": "general-summary", "intent": "request"},
        {"text": "Reporte de avance con observaciones y seguimiento de firma.", "features": [3, 4, 6, 2, 9, 0.64], "route": "GENERAL", "risk": "HIGH", "priority": "HIGH", "reportType": "document-trace", "intent": "statement"},
        {"text": "Asistencia de RRHH para vacaciones y control de personal.", "features": [1, 2, 2, 0, 1, 0.12], "route": "RRHH", "risk": "LOW", "priority": "NORMAL", "reportType": "general-summary", "intent": "request"},
        {"text": "Solicitud de cliente con documentación incompleta y urgencia.", "features": [2, 4, 5, 2, 2, 0.58], "route": "ATENCION", "risk": "HIGH", "priority": "URGENT", "reportType": "document-trace", "intent": "request"},
        {"text": "Caso legal con apelación, normativa y criterio jurídico.", "features": [2, 3, 6, 1, 4, 0.44], "route": "LEGAL", "risk": "NORMAL", "priority": "HIGH", "reportType": "general-summary", "intent": "statement"},
        {"text": "Cobro y presupuesto en revisión financiera.", "features": [1, 3, 4, 0, 1, 0.2], "route": "FINANCIERO", "risk": "NORMAL", "priority": "NORMAL", "reportType": "general-summary", "intent": "request"},
        {"text": "Error de sistema con incidencia y soporte urgente.", "features": [3, 9, 10, 3, 2, 0.79], "route": "SOPORTE", "risk": "HIGH", "priority": "URGENT", "reportType": "operational-risk", "intent": "request"},
        {"text": "Revisión de documentos y evidencia con trazabilidad.", "features": [2, 2, 3, 1, 3, 0.28], "route": "LEGAL", "risk": "NORMAL", "priority": "NORMAL", "reportType": "document-trace", "intent": "statement"},
        {"text": "Trámite de personal con licencia y permisos.", "features": [1, 1, 2, 0, 0, 0.1], "route": "RRHH", "risk": "LOW", "priority": "NORMAL", "reportType": "general-summary", "intent": "request"},
    ]

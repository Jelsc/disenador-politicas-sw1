from __future__ import annotations

import base64
from copy import deepcopy
import html
import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from app.tensorflow_core import TensorFlowCoreAdapter, get_tensorflow_core


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
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.1"))
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "1536"))
OLLAMA_TOP_P = float(os.getenv("OLLAMA_TOP_P", "0.9"))
OLLAMA_REPEAT_PENALTY = float(os.getenv("OLLAMA_REPEAT_PENALTY", "1.1"))
ASSISTANT_OLLAMA_NUM_PREDICT = 1200
ASSISTANT_OLLAMA_TOP_P = 0.8
ASSISTANT_OLLAMA_REPEAT_PENALTY = 1.12
REPORT_DRAFT_OLLAMA_NUM_PREDICT = 896
REPORT_DRAFT_OLLAMA_TOP_P = 0.75
REPORT_DRAFT_OLLAMA_REPEAT_PENALTY = 1.12
FORM_ASSIST_OLLAMA_NUM_PREDICT = 640
FORM_ASSIST_OLLAMA_TOP_P = 0.75
FORM_ASSIST_OLLAMA_REPEAT_PENALTY = 1.12
TF_MODEL_PATH = Path(os.getenv("AI_CORE_MODEL_PATH", "/app/models/ai-core.keras"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
AZURE_OPENAI_TIMEOUT_SECONDS = float(os.getenv("AZURE_OPENAI_TIMEOUT_SECONDS", "60"))


ROUTE_LABELS = ["GENERAL", "LEGAL", "FINANCIERO", "ATENCION", "SOPORTE", "RRHH"]
RISK_LABELS = ["LOW", "NORMAL", "HIGH"]
PRIORITY_LABELS = ["LOW", "NORMAL", "HIGH", "URGENT"]
REPORT_LABELS = ["general-summary", "operational-risk", "document-trace"]
INTENT_LABELS = ["statement", "request"]
DEPARTMENT_ALIASES = {
    "financiero": {"finanzas", "finanza"},
    "recursos humanos": {"rrhh", "rh", "talento humano"},
    "legal": {"legales", "juridica", "juridico", "asesoria legal"},
    "atencion": {"atencion al cliente", "cliente", "clientes"},
    "soporte": {"mesa de ayuda", "helpdesk"},
}


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
    def __init__(
        self,
        base_url: str = OLLAMA_URL,
        model: str = OLLAMA_MODEL,
        timeout_seconds: float = OLLAMA_TIMEOUT_SECONDS,
        temperature: float = OLLAMA_TEMPERATURE,
        num_ctx: int = OLLAMA_NUM_CTX,
        num_predict: int = OLLAMA_NUM_PREDICT,
        top_p: float = OLLAMA_TOP_P,
        repeat_penalty: float = OLLAMA_REPEAT_PENALTY,
    ) -> None:
        self.base_url = base_url
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.temperature = temperature
        self.num_ctx = num_ctx
        self.num_predict = num_predict
        self.top_p = top_p
        self.repeat_penalty = repeat_penalty

    def chat_json(
        self,
        system_prompt: str,
        user_payload: dict[str, Any],
        *,
        temperature: float | None = None,
        num_ctx: int | None = None,
        num_predict: int | None = None,
        top_p: float | None = None,
        repeat_penalty: float | None = None,
    ) -> dict[str, Any]:
        effective_temperature = self.temperature if temperature is None else temperature
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "format": {
                        "type": "object",
                        "properties": {
                            "suggestedRules": {
                                "type": "object",
                                "properties": {
                                    "departments": {"type": "array"},
                                    "laneHeights": {"type": "object"},
                                    "nodes": {"type": "array"},
                                    "connectors": {"type": "array"}
                                },
                                "required": ["departments", "nodes", "connectors"]
                            },
                            "answer": {"type": "string"},
                            "recommendations": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["suggestedRules", "answer", "recommendations"]
                    },
                    "options": {
                        "temperature": effective_temperature,
                        "num_ctx": self.num_ctx if num_ctx is None else num_ctx,
                        "num_predict": self.num_predict if num_predict is None else num_predict,
                        "top_p": self.top_p if top_p is None else top_p,
                        "repeat_penalty": self.repeat_penalty if repeat_penalty is None else repeat_penalty,
                    },
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

    def warmup(self) -> None:
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "keep_alive": "10m",
                    "options": {
                        "temperature": 0.0,
                        "num_ctx": 32,
                        "num_predict": 1,
                        "top_p": 0.1,
                        "repeat_penalty": 1.0,
                    },
                    "messages": [{"role": "user", "content": "warmup"}],
                },
            )
            response.raise_for_status()


class AzureOpenAIClient:
    def __init__(
        self,
        endpoint: str = AZURE_OPENAI_ENDPOINT,
        deployment: str = AZURE_OPENAI_DEPLOYMENT,
        api_key: str = AZURE_OPENAI_KEY,
        api_version: str = AZURE_OPENAI_API_VERSION,
        timeout_seconds: float = AZURE_OPENAI_TIMEOUT_SECONDS,
    ) -> None:
        self.endpoint = endpoint.strip().rstrip("/")
        self.deployment = deployment
        self.api_key = api_key
        self.api_version = api_version
        self.timeout_seconds = timeout_seconds

    @property
    def _uses_openai_v1(self) -> bool:
        return "/openai/v1" in self.endpoint.lower()

    @property
    def _chat_url(self) -> str:
        if self._uses_openai_v1:
            return f"{self.endpoint}/chat/completions"
        return f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions?api-version={self.api_version}"

    @property
    def _configured(self) -> bool:
        return bool(self.endpoint and self.api_key)

    def chat_json(self, system_prompt: str, user_payload: dict[str, Any], *, temperature: float = 0.2) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
            ],
            "response_format": {"type": "json_object"},
            "temperature": temperature,
            "max_tokens": 4096,
        }
        if self._uses_openai_v1:
            payload["model"] = self.deployment

        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(
                self._chat_url,
                headers={"api-key": self.api_key, "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()

        content = response.json()["choices"][0]["message"]["content"]
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
    _ASSISTANT_PROVIDER_PATTERN = re.compile(r"\b(?:TensorFlow|Ollama|Azure|OpenAI)\b", re.IGNORECASE)
    _ASSISTANT_STALE_MARKERS = (
        "propuse un flujo local",
        "modelo local listo",
        "flujo local con",
        "sin depender de",
        "integration path",
        "produced through the tensorflow integration path",
    )

    def __init__(self, ollama_client: OllamaClient | None = None, azure_client: AzureOpenAIClient | None = None, dl_core: DeepLearningCore | None = None, transcriber: WhisperTranscriber | None = None, tensor_core: TensorFlowCoreAdapter | None = None) -> None:
        self.ollama_client = ollama_client or OllamaClient()
        self.azure_client = azure_client or AzureOpenAIClient()
        self.dl_core = dl_core or DeepLearningCore()
        self.transcriber = transcriber or WhisperTranscriber()
        self.tensor_core = tensor_core or get_tensorflow_core()

    def warmup_ollama(self) -> None:
        warmup = getattr(self.ollama_client, "warmup", None)
        if callable(warmup):
            warmup()

    def _normalize_text(self, value: str | None) -> str:
        return re.sub(r"\s+", " ", value or "").strip().lower()

    def _build_assistant_prediction(self, request: dict[str, Any], simulation: dict[str, Any]) -> dict[str, Any]:
        prompt = str(request.get("prompt") or "")
        history = self._summarize_history(request.get("history") or [])
        anomalies = [str(item).strip() for item in ((simulation.get("errors") or []) + (simulation.get("warnings") or []) + (simulation.get("bottlenecks") or [])) if str(item).strip()]
        structured = self.tensor_core.structured_intake(prompt, {"availableDepartments": request.get("availableDepartments") or [], "rules": request.get("rules") or {}}, request.get("policyName"))
        prediction = self.tensor_core.analyst_prediction(prompt, {"anomalyScore": history.anomaly_score, "sampleSize": history.sample_size}, anomalies)
        return {
            "route": prediction.get("route") or "GENERAL",
            "risk": prediction.get("risk") or "NORMAL",
            "priority": prediction.get("priority") or "NORMAL",
            "intent": structured.get("structuredFields", {}).get("intent") or "statement",
            "confidence": float(max(float(prediction.get("confidence") or 0.0), float(structured.get("confidence") or 0.0))),
            "structuredFields": structured.get("structuredFields") if isinstance(structured.get("structuredFields"), dict) else {},
            "policyAssignment": structured.get("policyAssignment"),
            "suggestedNextAction": structured.get("suggestedNextAction"),
        }

    def _sanitize_assistant_suggested_rules(self, candidate: Any, fallback_rules: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(candidate, dict):
            return None

        departments = candidate.get("departments")
        if not isinstance(departments, list):
            departments = list(fallback_rules.get("departments") or [])

        lane_heights = candidate.get("laneHeights") if isinstance(candidate.get("laneHeights"), dict) else dict(fallback_rules.get("laneHeights") or {})
        nodes = list(candidate.get("nodes") or []) if isinstance(candidate.get("nodes"), list) else []
        connectors = list(candidate.get("connectors") or []) if isinstance(candidate.get("connectors"), list) else []

        return {
            "version": candidate.get("version", fallback_rules.get("version", 1)),
            "departments": departments,
            "laneHeights": lane_heights,
            "nodes": nodes,
            "connectors": connectors,
        }

    def _assistant_rules_changed(self, candidate: dict[str, Any], baseline: dict[str, Any]) -> bool:
        return json.dumps(candidate, ensure_ascii=False, sort_keys=True) != json.dumps(baseline, ensure_ascii=False, sort_keys=True)

    def _normalize_rules_snapshot(self, rules: dict[str, Any] | None) -> dict[str, Any]:
        current = deepcopy(rules or {})
        return {
            "version": int(current.get("version") or 1),
            "departments": list(deepcopy(current.get("departments") or [])),
            "laneHeights": dict(current.get("laneHeights") or {}),
            "nodes": list(deepcopy(current.get("nodes") or [])),
            "connectors": list(deepcopy(current.get("connectors") or [])),
        }

    def _requested_departments_for_prompt(self, request: dict[str, Any]) -> list[dict[str, Any]]:
        prompt = self._normalize_text(str(request.get("prompt") or ""))
        rules = request.get("rules") or {}
        candidates = list((rules.get("departments") or [])) + list((request.get("availableDepartments") or []))
        selected: list[dict[str, Any]] = []
        seen: set[str] = set()
        for department in candidates:
            if not isinstance(department, dict):
                continue
            department_id = str(department.get("id") or department.get("name") or "").strip()
            if not department_id or department_id in seen:
                continue
            name = self._normalize_text(str(department.get("name") or department.get("id") or ""))
            aliases = DEPARTMENT_ALIASES.get(name, set())
            if any(token and token in prompt for token in {name, self._normalize_text(str(department.get("id") or "")), *aliases}):
                selected.append(department)
                seen.add(department_id)
        if selected:
            return selected
        if any(word in prompt for word in ["gener", "crear", "arma", "armar", "flujo", "formulario", "captura", "diagrama"]):
            for department in candidates:
                if isinstance(department, dict):
                    department_id = str(department.get("id") or department.get("name") or "").strip()
                    if department_id and department_id not in seen:
                        selected.append(department)
                        seen.add(department_id)
            if selected:
                return selected
            return [{"id": "general", "name": "General"}]
        return []

    def _assistant_task_type_for_prompt(self, normalized_prompt: str, route: str, is_final_step: bool = False) -> str:
        if any(word in normalized_prompt for word in ["aprob", "valid", "firm", "autoriza", "cierra"]):
            return "APPROVAL"
        if any(word in normalized_prompt for word in ["revis", "observ", "control", "verific", "cheque"]):
            return "REVIEW"
        if any(word in normalized_prompt for word in ["ingres", "captur", "carga", "registro", "document", "adjunt"]):
            return "MANUAL"
        if is_final_step and route in {"LEGAL", "AUDITOR"}:
            return "APPROVAL"
        return "MANUAL"

    def _build_assistant_suggested_rules(self, request: dict[str, Any], simulation: dict[str, Any], prediction: dict[str, Any]) -> dict[str, Any]:
        prompt = str(request.get("prompt") or "")
        normalized_prompt = self._normalize_text(prompt)
        suggested = self._normalize_rules_snapshot(request.get("rules") or {})
        departments = self._requested_departments_for_prompt(request)
        flow_intent = any(word in normalized_prompt for word in ["gener", "crear", "arma", "armar", "flujo", "formulario", "captura", "diagrama", "proceso", "bandeja"])

        if self.azure_client._configured:
            try:
                payload = {
                    "prompt": prompt,
                    "policyName": request.get("policyName"),
                    "currentRules": suggested,
                    "availableDepartments": request.get("availableDepartments") or [],
                    "prediction": {
                        "route": prediction["route"],
                        "risk": prediction["risk"],
                        "priority": prediction["priority"],
                        "intent": prediction["intent"],
                    },
                    "simulation": {
                        "status": simulation.get("status"),
                        "errors": simulation.get("errors") or [],
                        "warnings": simulation.get("warnings") or [],
                        "bottlenecks": simulation.get("bottlenecks") or [],
                    },
                }
                data = self.azure_client.chat_json(
                    "Sos un asistente de diseño de politicas. Respondé con JSON estricto que incluya suggestedRules y answer. "
                    "No menciones proveedores, plataformas, modelos ni tecnologias especificas. "
                    "Devolvé una propuesta aplicable sobre el flujo actual, no una respuesta vacía.",
                    payload,
                    temperature=0.2,
                )
                candidate = self._sanitize_assistant_suggested_rules(data.get("suggestedRules"), suggested)
                if candidate and self._assistant_rules_changed(candidate, suggested):
                    return candidate
            except Exception:
                pass

        if not departments and suggested["departments"]:
            departments = [department for department in suggested["departments"] if isinstance(department, dict)]
        if not departments:
            departments = [department for department in (request.get("availableDepartments") or []) if isinstance(department, dict)]
        if not departments and flow_intent:
            departments = [{"id": "general", "name": "General"}]

        for department in departments:
            if isinstance(department, dict):
                department_id = str(department.get("id") or department.get("name") or "").strip()
                if department_id and not any(str(existing.get("id") or "") == department_id for existing in suggested["departments"] if isinstance(existing, dict)):
                    suggested["departments"].append(deepcopy(department))

        if not suggested["laneHeights"] and suggested["departments"]:
            suggested["laneHeights"] = {
                str(department.get("id") or department.get("name") or f"lane-{index}"): 96 + (index * 132)
                for index, department in enumerate(suggested["departments"])
                if isinstance(department, dict)
            }

        if suggested["nodes"] or not (flow_intent or suggested["departments"]):
            return suggested

        if not departments:
            departments = [{"id": "general", "name": "General"}]

        nodes: list[dict[str, Any]] = []
        connectors: list[dict[str, Any]] = []
        start_id = "node-start-001"
        end_id = "node-end-001"
        first_department = departments[0]
        first_department_id = str(first_department.get("id") or first_department.get("name") or "general")
        task_departments = departments
        start_y = int(suggested["laneHeights"].get(first_department_id, 120)) if suggested["laneHeights"] else 120
        nodes.append({"id": start_id, "type": "START", "label": "Inicio", "departmentId": first_department_id, "x": 160, "y": start_y})

        intake_id = "node-intake-001"
        intake_task_type = self._assistant_task_type_for_prompt(normalized_prompt, str(prediction.get("route") or "GENERAL"))
        nodes.append({
            "id": intake_id,
            "type": "TASK",
            "label": "Ingreso y validación inicial",
            "departmentId": first_department_id,
            "x": 360,
            "y": start_y,
            "config": {
                "taskType": intake_task_type,
                "estimatedTime": 8,
                "form": {
                    "title": "Validación inicial",
                    "fields": [
                        {"id": f"{intake_id}_notes", "type": "TEXT", "label": "Observaciones", "required": True, "order": 1, "visibleToClient": False},
                        {"id": f"{intake_id}_evidence", "type": "ATTACHMENT", "label": "Evidencia", "required": False, "order": 2, "visibleToClient": False},
                    ],
                },
            },
        })
        connectors.append({"id": f"conn-{start_id}-{intake_id}", "sourceId": start_id, "targetId": intake_id, "type": "CONTROL_FLOW"})

        prev_id = intake_id
        for index, department in enumerate(task_departments, start=1):
            department_id = str(department.get("id") or department.get("name") or f"dept-{index}")
            department_name = str(department.get("name") or department_id).strip() or f"Departamento {index}"
            task_id = f"node-task-{index:02d}"
            task_type = self._assistant_task_type_for_prompt(normalized_prompt, str(prediction.get("route") or "GENERAL"), index == len(task_departments))
            task_label = "Aprobación" if task_type == "APPROVAL" else "Revisión" if task_type == "REVIEW" else "Gestión"
            estimated_time = 24 if prediction.get("priority") == "URGENT" else 16 if task_type == "REVIEW" else 12
            nodes.append({
                "id": task_id,
                "type": "TASK",
                "label": f"{task_label} {department_name}",
                "departmentId": department_id,
                "x": 160 + (index * 220),
                "y": int(suggested["laneHeights"].get(department_id, start_y)),
                "config": {
                    "taskType": task_type,
                    "estimatedTime": estimated_time,
                    "form": {
                        "title": f"Formulario {department_name}",
                        "fields": [
                            {"id": f"{task_id}_notes", "type": "TEXT", "label": "Observaciones", "required": True, "order": 1, "visibleToClient": False},
                            {"id": f"{task_id}_support", "type": "ATTACHMENT", "label": "Soporte", "required": False, "order": 2, "visibleToClient": False},
                        ],
                    },
                },
            })
            connectors.append({"id": f"conn-{prev_id}-{task_id}", "sourceId": prev_id, "targetId": task_id, "type": "CONTROL_FLOW"})
            prev_id = task_id

        nodes.append({"id": end_id, "type": "END", "label": "Fin", "departmentId": first_department_id, "x": 160 + ((len(task_departments) + 2) * 220), "y": start_y})
        connectors.append({"id": f"conn-{prev_id}-{end_id}", "sourceId": prev_id, "targetId": end_id, "type": "CONTROL_FLOW"})

        suggested["nodes"] = nodes
        suggested["connectors"] = connectors
        return suggested

    def _build_assistant_recommendations(self, prompt: str, simulation: dict[str, Any], prediction: dict[str, Any], suggested_rules: dict[str, Any]) -> list[str]:
        recommendations: list[str] = []
        normalized_prompt = self._normalize_text(prompt)
        if simulation.get("errors"):
            recommendations.append("Primero corregí errores estructurales antes de agregar más pasos.")
        if simulation.get("warnings"):
            recommendations.append("Revisá las advertencias para evitar que el flujo quede frágil al publicar.")
        department_count = len(suggested_rules.get("departments") or [])
        node_count = len(suggested_rules.get("nodes") or [])
        if node_count:
            recommendations.append(f"La propuesta local quedó alineada a {department_count} departamentos y {node_count} nodos.")
            recommendations.append("Revisá si el primer paso debe ser solo lectura o también captura de evidencia.")
        if any(word in normalized_prompt for word in ["firma", "firmar"]):
            recommendations.append("Dejá la firma para el último paso operativo que realmente cierre el trámite.")
        if any(word in normalized_prompt for word in ["aprob", "valid", "autoriza", "cierra"]):
            recommendations.append("Separá la validación de la aprobación final para mantener trazabilidad.")
        if any(word in normalized_prompt for word in ["revis", "observ", "control", "verific", "cheque"]):
            recommendations.append("Convertí cada revisión en un paso explícito con responsable y salida clara.")
        if any(word in normalized_prompt for word in ["adjunt", "evid", "document", "archivo"]):
            recommendations.append("Pedí evidencia o adjuntos solo donde aporten control real.")
        if any(word in normalized_prompt for word in ["rama", "bifur", "decision", "decisión", "resultado"]):
            recommendations.append("Definí el criterio de bifurcación para que el diagrama no quede ambiguo.")
        if simulation.get("status") == "warning" and not simulation.get("errors"):
            recommendations.append("Las advertencias sugieren revisar orden y dependencia antes de publicar.")
        if prediction.get("risk") == "HIGH" or prediction.get("priority") == "URGENT":
            recommendations.append("Mantené el flujo corto y con validaciones indispensables.")
        if not recommendations:
            recommendations.append("La predicción local mejora cuando el prompt menciona el área, el tipo de trámite y los puntos de aprobación.")
            recommendations.append("Si ya tenés departamentos definidos, pasalos en rules.departments para obtener un diagrama más preciso.")
        return list(dict.fromkeys(recommendations))[:8]

    def _sanitize_assistant_answer(self, answer: str) -> str:
        cleaned = self._ASSISTANT_PROVIDER_PATTERN.sub("", answer)
        cleaned = re.sub(r"\s{2,}", " ", cleaned)
        cleaned = re.sub(r"\s+([,.;:])", r"\1", cleaned)
        return cleaned.strip()

    def _assistant_answer_needs_rewrite(self, answer: str) -> bool:
        normalized = self._normalize_text(answer)
        if not normalized:
            return True
        if self._ASSISTANT_PROVIDER_PATTERN.search(answer):
            return True
        return any(marker in normalized for marker in self._ASSISTANT_STALE_MARKERS)

    def _build_generic_assistant_answer(self, request: dict[str, Any], prediction: dict[str, Any], suggested_rules: dict[str, Any]) -> str:
        policy_name = str(request.get("policyName") or "esta política").strip() or "esta política"
        department_count = len(suggested_rules.get("departments") or [])
        node_count = len(suggested_rules.get("nodes") or [])
        connector_count = len(suggested_rules.get("connectors") or [])
        route = str(prediction.get("route") or "GENERAL")
        priority = str(prediction.get("priority") or "NORMAL")
        risk = str(prediction.get("risk") or "NORMAL")

        if node_count:
            return (
                f"Te dejé una propuesta actualizada para {policy_name}: ruta {route}, prioridad {priority} y riesgo {risk}. "
                f"La estructura quedó con {department_count} departamentos, {node_count} nodos y {connector_count} conectores para revisar y aplicar."
            )
        if department_count:
            return (
                f"Te dejé una base editable para {policy_name}: ruta {route}, prioridad {priority} y riesgo {risk}. "
                f"La pizarra ya tiene {department_count} departamentos cargados para seguir armando el flujo."
            )
        return (
            f"Analicé la solicitud para {policy_name}: ruta {route}, prioridad {priority} y riesgo {risk}. "
            "Te dejo una respuesta limpia para seguir ajustando el flujo sin arrastrar texto viejo."
        )

    def _build_assistant_fallback_answer(self, prediction: dict[str, Any], suggested_rules: dict[str, Any]) -> str:
        department_count = len(suggested_rules.get("departments") or [])
        node_count = len(suggested_rules.get("nodes") or [])
        if suggested_rules.get("nodes"):
            answer = (
                f"Te propongo un flujo base para {prediction['route']} con prioridad {prediction['priority']} y riesgo {prediction['risk']}. "
                f"Quedó armado con {department_count} departamentos y {node_count} nodos."
            )
        else:
            answer = (
                f"Analicé el caso como {prediction['route']} con prioridad {prediction['priority']} y riesgo {prediction['risk']}. "
                "Si querés, puedo convertirlo en un flujo base con departamentos y tareas operativas."
            )
        return self._sanitize_assistant_answer(answer)

    def _build_assistant_answer(self, request: dict[str, Any], simulation: dict[str, Any], prediction: dict[str, Any], suggested_rules: dict[str, Any]) -> tuple[str, Literal["azure", "tensorflow"]]:
        prompt = str(request.get("prompt") or "")
        payload = {
            "prompt": prompt,
            "policyName": request.get("policyName"),
            "prediction": {
                "route": prediction["route"],
                "risk": prediction["risk"],
                "priority": prediction["priority"],
                "intent": prediction["intent"],
            },
            "simulation": {
                "status": simulation.get("status"),
                "errors": simulation.get("errors") or [],
                "warnings": simulation.get("warnings") or [],
                "bottlenecks": simulation.get("bottlenecks") or [],
            },
            "counts": {
                "departments": len(suggested_rules.get("departments") or []),
                "nodes": len(suggested_rules.get("nodes") or []),
            },
        }
        if self.azure_client._configured:
            try:
                data = self.azure_client.chat_json(
                    "Sos un asistente de diseño de politicas. Respondé con JSON estricto que incluya answer. "
                    "No menciones proveedores, plataformas, modelos ni tecnologias especificas. "
                    "El tono debe ser natural, dinamico y util.",
                    payload,
                    temperature=0.2,
                )
                answer = str(data.get("answer") or "").strip()
                if answer:
                    cleaned_answer = self._sanitize_assistant_answer(answer)
                    if self._assistant_answer_needs_rewrite(answer):
                        cleaned_answer = self._build_generic_assistant_answer(request, prediction, suggested_rules)
                    return cleaned_answer, "azure"
            except Exception:
                pass
        return self._build_generic_assistant_answer(request, prediction, suggested_rules), "tensorflow"

    def _chat_json(
        self,
        system_prompt: str,
        user_payload: dict[str, Any],
        *,
        temperature: float | None = None,
        ollama_num_ctx: int | None = None,
        ollama_num_predict: int | None = None,
        ollama_top_p: float | None = None,
        ollama_repeat_penalty: float | None = None,
        ollama_temperature: float | None = None,
    ) -> tuple[dict[str, Any], str]:
        """Try Ollama first, then Azure OpenAI, then raise.
        Returns (data, source) where source is 'ollama' or 'azure'."""
        try:
            data = self.ollama_client.chat_json(
                system_prompt,
                user_payload,
                temperature=ollama_temperature,
                num_ctx=ollama_num_ctx,
                num_predict=ollama_num_predict,
                top_p=ollama_top_p,
                repeat_penalty=ollama_repeat_penalty,
            )
            return data, "ollama"
        except Exception:
            if self.azure_client._configured:
                try:
                    data = self.azure_client.chat_json(system_prompt, user_payload, temperature=temperature)
                    return data, "azure"
                except Exception:
                    raise
            raise

    def assistant(self, request: dict[str, Any], simulation: dict[str, Any]) -> dict[str, Any]:
        prediction = self._build_assistant_prediction(request, simulation)
        suggested_rules = self._build_assistant_suggested_rules(request, simulation, prediction)
        answer, source = self._build_assistant_answer(request, simulation, prediction, suggested_rules)
        return {
            "answer": answer,
            "recommendations": self._build_assistant_recommendations(str(request.get("prompt") or ""), simulation, prediction, suggested_rules),
            "suggestedRules": suggested_rules,
            "modelSource": source,
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
        structured = self.tensor_core.structured_intake(transcript, request.get("context") or {}, request.get("policyName"))
        structured_fields = structured.get("structuredFields") if isinstance(structured.get("structuredFields"), dict) else {}
        structured_fields.setdefault("intent", predictions["intent"])
        structured_fields.setdefault("routeHint", predictions["route"].lower())
        structured_fields.setdefault("summary", transcript[:160])
        policy_assignment = structured.get("policyAssignment")
        if not isinstance(policy_assignment, str) or not policy_assignment.strip():
            policy_assignment = request.get("policyName") or f"{predictions['route'].lower()}-policy-candidate"
        suggested_next_action = structured.get("suggestedNextAction")
        if not isinstance(suggested_next_action, str) or not suggested_next_action.strip():
            suggested_next_action = f"Route to {predictions['route']} workflow review."
        return {
            "transcript": transcript,
            "source": "audio" if request.get("audioBase64") else "text",
            "confidence": float(structured.get("confidence") or predictions["confidence"]),
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
        data, _ = self._chat_json(
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
                "modelSource": "heuristic",
                "recommendations": ["Compartí el texto del caso o un audio breve para preparar el borrador."],
                "reportType": None,
            }
        history = self._summarize_history([])
        predictions = self.dl_core.predict(transcript, history)

        try:
            return self._build_local_report_draft(request, transcript, predictions)
        except Exception:
            return self._build_remote_report_draft(request, transcript, predictions)

    def _build_local_report_draft(self, request: dict[str, Any], transcript: str, predictions: dict[str, Any]) -> dict[str, Any]:
        analysis = self._analyze_report_request(request, transcript, predictions)
        tensorflow_draft = self.tensor_core.report_generation(transcript, request.get("context") or {}, analysis["policyName"])
        return {
            "draftTitle": self._build_report_title(analysis["reportType"], analysis["policyName"]),
            "draftBody": self._build_report_draft_html(analysis, transcript, predictions, tensorflow_draft),
            "missingFields": analysis["missingFields"],
            "clarification": None,
            "confidence": analysis["confidence"],
            "modelSource": "tensorflow",
            "recommendations": analysis["recommendations"],
            "reportType": analysis["reportType"],
        }

    def _build_remote_report_draft(self, request: dict[str, Any], transcript: str, predictions: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "transcript": transcript,
            "policyName": request.get("policyName"),
            "context": request.get("context") or {},
            "predictions": predictions,
            "instruction": "Return JSON strict with draftTitle, draftBody, missingFields, clarification, confidence, reportType. Use only the transcript and context, keep the draft factual, and list missingFields instead of inventing facts.",
        }
        try:
            data, source = self._chat_json(
                "Sos un redactor de informes. Devolvé SOLO JSON estricto, con tono profesional y factual. No inventes fechas, responsables ni hechos que no estén en el transcript o el contexto.",
                payload,
                ollama_temperature=0.0,
                ollama_num_predict=REPORT_DRAFT_OLLAMA_NUM_PREDICT,
                ollama_top_p=REPORT_DRAFT_OLLAMA_TOP_P,
                ollama_repeat_penalty=REPORT_DRAFT_OLLAMA_REPEAT_PENALTY,
            )
        except Exception as exc:
            return self._heuristic_report_draft(request, transcript, predictions, f"La IA no respondió: {type(exc).__name__}.")
        if not isinstance(data, dict):
            return self._heuristic_report_draft(request, transcript, predictions, "La IA devolvió una respuesta inválida.")

        draft_title = data.get("draftTitle") if isinstance(data.get("draftTitle"), str) and data.get("draftTitle").strip() else self._build_report_title(predictions["reportType"], request.get("policyName") or predictions["route"])
        draft_body = data.get("draftBody") if isinstance(data.get("draftBody"), str) and data.get("draftBody").strip() else transcript
        missing_fields = [str(item) for item in (data.get("missingFields") if isinstance(data.get("missingFields"), list) else []) if str(item).strip()]
        clarification = data.get("clarification") if isinstance(data.get("clarification"), str) or data.get("clarification") is None else None
        recommendations = [str(item).strip() for item in (data.get("recommendations") if isinstance(data.get("recommendations"), list) else []) if str(item).strip()]
        report_type = data.get("reportType") if isinstance(data.get("reportType"), str) and data.get("reportType").strip() else predictions["reportType"]

        if self._is_thin_report_draft(str(draft_body), request.get("text") or request.get("transcript") or "", transcript):
            return self._heuristic_report_draft(request, transcript, predictions, clarification)

        return {
            "draftTitle": str(draft_title).strip(),
            "draftBody": str(draft_body).strip(),
            "missingFields": missing_fields,
            "clarification": clarification,
            "confidence": float(data.get("confidence") or predictions["confidence"]),
            "modelSource": source,
            "recommendations": recommendations,
            "reportType": str(report_type),
        }

    def _analyze_report_request(self, request: dict[str, Any], transcript: str, predictions: dict[str, Any]) -> dict[str, Any]:
        context = request.get("context") if isinstance(request.get("context"), dict) else {}
        prompt_text = str(request.get("text") or request.get("transcript") or transcript)
        policy_name = str(request.get("policyName") or context.get("policyName") or predictions["route"] or "la política").strip()
        policy_status = self._first_context_value(context, ("policyStatus", "status", "state", "policyState"))
        policy_owner = self._first_context_value(context, ("owner", "responsible", "responsibleArea", "area", "department", "departmentName"))
        policy_deadline = self._first_context_value(context, ("deadline", "dueDate", "targetDate", "sla"))
        diagram_context = self._first_context_value(context, ("diagramContext", "diagram", "graph", "flow", "board"))
        rules_context = self._first_context_value(context, ("rules", "policyRules", "rulesSnapshot"))
        report_type = self._infer_report_type(prompt_text, transcript, predictions)

        prompt_excerpt = self._shorten_report_text(prompt_text or transcript, 220)
        signal_lines = [
            f"El pedido del usuario fue: {prompt_excerpt}.",
            f"Predicción local: ruta {predictions['route']}, riesgo {predictions['risk']} y prioridad {predictions['priority']}.",
        ]
        if policy_status:
            signal_lines.append(f"La política figura como {self._shorten_report_text(str(policy_status), 120)}.")
        if policy_owner:
            signal_lines.append(f"Responsable o área: {self._shorten_report_text(str(policy_owner), 120)}.")
        if policy_deadline:
            signal_lines.append(f"Plazo o SLA: {self._shorten_report_text(str(policy_deadline), 120)}.")
        if diagram_context:
            signal_lines.append(f"Contexto del diagrama: {self._summarize_context_value(diagram_context)}.")
        if rules_context:
            signal_lines.append(f"Reglas recibidas: {self._summarize_context_value(rules_context)}.")

        missing_fields: list[str] = []
        weak_signals: list[str] = []
        if not policy_status:
            missing_fields.append("context.policyStatus")
            weak_signals.append("No se informó el estado actual de la política.")
        if not diagram_context:
            missing_fields.append("context.diagramContext")
            weak_signals.append("No se recibió contexto del diagrama o flujo.")
        if not rules_context:
            missing_fields.append("context.rules")
            weak_signals.append("No se recibió un snapshot de reglas.")

        recommendations = self._build_report_recommendations(report_type, predictions, weak_signals)
        context_highlights: list[str] = []
        if policy_status:
            context_highlights.append(f"Estado operativo: {self._shorten_report_text(str(policy_status), 120)}.")
        if policy_owner:
            context_highlights.append(f"Responsable o área: {self._shorten_report_text(str(policy_owner), 120)}.")
        if policy_deadline:
            context_highlights.append(f"Plazo o SLA: {self._shorten_report_text(str(policy_deadline), 120)}.")
        if diagram_context:
            context_highlights.append(f"Diagrama: {self._summarize_context_value(diagram_context)}.")
        if rules_context:
            context_highlights.append(f"Reglas: {self._summarize_context_value(rules_context)}.")

        next_steps = [
            "Revisar el borrador con la información operativa confirmada.",
        ]
        field_labels = {
            "context.policyStatus": "estado actual de la política",
            "context.diagramContext": "contexto del diagrama",
            "context.rules": "snapshot de reglas",
        }
        for field in missing_fields:
            label = field_labels.get(field, field)
            next_steps.append(f"Confirmar {label}.")
        if not policy_owner:
            next_steps.append("Definir responsable o área para cerrar el reporte con trazabilidad.")
        if not policy_deadline:
            next_steps.append("Agregar plazo o SLA para priorizar el seguimiento.")

        confidence = min(0.97, max(0.84, float(predictions.get("confidence") or 0.0) + (0.02 if policy_status else 0.0) + (0.02 if diagram_context or rules_context else 0.0)))
        return {
            "policyName": policy_name,
            "policyStatus": self._shorten_report_text(str(policy_status), 120) if policy_status else "",
            "diagramSummary": self._summarize_context_value(diagram_context),
            "rulesSummary": self._summarize_context_value(rules_context),
            "contextHighlights": context_highlights,
            "reportType": report_type,
            "missingFields": missing_fields,
            "weakSignals": weak_signals,
            "signalLines": signal_lines,
            "confidence": confidence,
            "recommendations": recommendations,
            "nextSteps": list(dict.fromkeys(next_steps))[:5],
        }

    def _infer_report_type(self, prompt_text: str, transcript: str, predictions: dict[str, Any]) -> str:
        normalized = self._normalize_report_text(f"{prompt_text} {transcript}")
        if any(keyword in normalized for keyword in ("riesgo operativo", "operational risk", "riesgo", "operativo", "demora", "firma pendiente", "incumpl", "bloqueo", "atraso")):
            return "operational-risk"
        if any(keyword in normalized for keyword in ("trazabilidad", "documento", "evidencia", "audit", "auditoria", "archivo", "registro", "trace")):
            return "document-trace"
        predicted = str(predictions.get("reportType") or "").strip()
        return predicted if predicted in {"general-summary", "operational-risk", "document-trace"} else "general-summary"

    def _build_report_title(self, report_type: str, policy_name: str) -> str:
        clean_policy_name = policy_name.strip() or "la política"
        if report_type == "operational-risk":
            return f"Reporte de riesgo operativo - {clean_policy_name}"
        if report_type == "document-trace":
            return f"Reporte de trazabilidad documental - {clean_policy_name}"
        return f"Resumen ejecutivo - {clean_policy_name}"

    def _build_report_recommendations(self, report_type: str, predictions: dict[str, Any], weak_signals: list[str]) -> list[str]:
        recommendations: list[str] = []
        if report_type == "operational-risk":
            recommendations.extend([
                "Validar responsables, plazos y dependencias críticas antes de cerrar la política.",
                "Confirmar si la demora o la firma pendiente requieren escalamiento operativo.",
                "Registrar el estado actual del flujo para que el riesgo quede trazable.",
            ])
        elif report_type == "document-trace":
            recommendations.extend([
                "Corroborar la trazabilidad documental y conservar evidencia de cada aprobación.",
                "Revisar si faltan adjuntos, firmas o referencias normativas para completar el circuito.",
                "Anotar versión, origen y última modificación de cada documento citado.",
            ])
        else:
            recommendations.extend([
                "Revisar el alcance de la política y validar los datos de contexto antes de circular el informe.",
                "Completar el estado actual del flujo para evitar conclusiones incompletas.",
                "Mantener el resumen acotado a hechos observables y próximos pasos verificables.",
            ])

        if str(predictions.get("risk") or "").upper() == "HIGH":
            recommendations.append("Tratar el caso como prioritario por el nivel de riesgo detectado.")
        if str(predictions.get("priority") or "").upper() in {"HIGH", "URGENT"}:
            recommendations.append("Alinear el borrador con una ventana de seguimiento corta.")
        if weak_signals:
            recommendations.append("Completar el contexto faltante para reforzar la lectura del reporte.")
        return list(dict.fromkeys(recommendations))[:5]

    def _first_context_value(self, context: dict[str, Any], keys: tuple[str, ...]) -> Any:
        for key in keys:
            value = context.get(key)
            if value not in (None, "", [], {}):
                return value
        return None

    def _summarize_context_value(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return self._shorten_report_text(value, 120)
        if isinstance(value, list):
            if not value:
                return "0 elementos"
            preview = [self._summarize_context_value(item) for item in value[:3]]
            preview = [item for item in preview if item]
            return f"{len(value)} elementos" + (f" ({'; '.join(preview)})" if preview else "")
        if isinstance(value, dict):
            fragments: list[str] = []
            for key in ("nodes", "connectors", "edges", "departments", "steps", "rules"):
                item = value.get(key)
                if isinstance(item, list):
                    preview = [self._summarize_context_value(entry) for entry in item[:2]]
                    preview = [entry for entry in preview if entry]
                    suffix = f" ({'; '.join(preview)})" if preview else ""
                    fragments.append(f"{key}={len(item)}{suffix}")
                elif isinstance(item, dict):
                    fragments.append(f"{key}={len(item)} claves")
            for key in ("status", "policyStatus", "type", "name"):
                item = value.get(key)
                if item not in (None, ""):
                    fragments.append(f"{key}={self._shorten_report_text(str(item), 40)}")
            if fragments:
                return "; ".join(fragments[:5])
            sample = []
            for key, item in list(value.items())[:4]:
                item_summary = self._summarize_context_value(item)
                if item_summary:
                    sample.append(f"{key}={item_summary}")
            return "; ".join(sample)
        return self._shorten_report_text(str(value), 120)

    def _render_report_list(self, items: list[str], empty_message: str) -> str:
        if not items:
            return f"<p>{html.escape(empty_message)}</p>"
        return "<ul>" + "".join(f"<li>{html.escape(item)}</li>" for item in items) + "</ul>"

    def _build_report_draft_html(self, analysis: dict[str, Any], transcript: str, predictions: dict[str, Any], tensorflow_draft: dict[str, Any] | None = None) -> str:
        transcript_excerpt = self._shorten_report_text(transcript, 240)
        report_type = str(analysis["reportType"])
        route = str(predictions["route"])
        context_highlights = list(analysis.get("contextHighlights") or [])
        if not context_highlights:
            context_highlights = ["No se recibieron señales operativas adicionales."]
        next_steps = list(analysis.get("nextSteps") or [])
        if not next_steps:
            next_steps = ["Revisar el borrador con el equipo responsable antes de enviarlo."]

        tensorflow_section = ""
        if isinstance(tensorflow_draft, dict):
            tensor_title = str(tensorflow_draft.get("title") or "").strip()
            tensor_body = [line.strip() for line in str(tensorflow_draft.get("body") or "").splitlines() if line.strip()]
            tensor_confidence = float(tensorflow_draft.get("confidence") or 0.0)
            if tensor_body:
                tensorflow_section = (
                    '<section>'
                    '<h2>TensorFlow Base Draft</h2>'
                    f'<p>La lectura local aportó un borrador base{f" para <strong>{html.escape(tensor_title)}</strong>" if tensor_title else ""} con confianza {tensor_confidence:.2f}.</p>'
                    f'{self._render_report_list(tensor_body, "Sin borrador base local.")}'
                    '</section>'
                )

        executive_summary = (
            f"Se generó un borrador local para <strong>{html.escape(analysis['policyName'])}</strong>. "
            f"El pedido se interpretó como <strong>{html.escape(report_type.replace('-', ' '))}</strong> con ruta <strong>{html.escape(route)}</strong>, "
            f"riesgo <strong>{html.escape(str(predictions['risk']))}</strong> y prioridad <strong>{html.escape(str(predictions['priority']))}</strong>."
        )

        context_signals = list(analysis["signalLines"])
        context_signals.append(f"Transcripción base: {transcript_excerpt}.")

        return (
            '<div class="report-draft">'
            '<section>'
            '<h2>Executive Summary</h2>'
            f'<p>{executive_summary}</p>'
            '</section>'
            '<section>'
            '<h2>Input Snapshot</h2>'
            f'<p>La lectura local clasifica el caso como <strong>{html.escape(report_type.replace("-", " "))}</strong> y mantiene la confianza en {analysis["confidence"]:.2f}.</p>'
            f'{self._render_report_list(context_signals, "No se registró el pedido base.")}'
            '</section>'
            f'{tensorflow_section}'
            '<section>'
            '<h2>Context Signals</h2>'
            f'{self._render_report_list(context_highlights, "No se registraron señales de contexto adicionales.")}'
            '</section>'
            '<section>'
            '<h2>Weak Signals</h2>'
            f'{self._render_report_list(analysis["weakSignals"], "No se detectaron señales débiles relevantes.")}'
            '</section>'
            '<section>'
            '<h2>Recommendations</h2>'
            f'{self._render_report_list(analysis["recommendations"], "Sin recomendaciones adicionales.")}'
            '</section>'
            '<section>'
            '<h2>Next Steps</h2>'
            f'{self._render_report_list(next_steps, "Sin próximos pasos adicionales.")}'
            '</section>'
            '</div>'
        )

    def _is_thin_report_draft(self, draft_body: str, prompt: str, transcript: str) -> bool:
        normalized_body = self._normalize_report_text(draft_body)
        if not normalized_body:
            return True

        normalized_prompt = self._normalize_report_text(prompt)
        normalized_transcript = self._normalize_report_text(transcript)

        if "<h2" in draft_body.lower() or "<section" in draft_body.lower() or "<ul" in draft_body.lower():
            return False

        if normalized_body == normalized_prompt or normalized_body == normalized_transcript:
            return True

        if normalized_prompt and normalized_prompt in normalized_body and len(normalized_body.split()) < 40:
            return True

        prompt_echo_markers = (
            "generame un reporte",
            "genera un reporte",
            "reporte de riesgo operativo",
            "sobre esta política",
            "sobre esta politica",
        )
        if any(marker in normalized_body for marker in prompt_echo_markers) and len(normalized_body.split()) < 40:
            return True

        return len(normalized_body) < 120

    def _normalize_report_text(self, value: str) -> str:
        return re.sub(r"\s+", " ", value or "").strip().lower()

    def _shorten_report_text(self, value: str, limit: int) -> str:
        normalized = re.sub(r"\s+", " ", value or "").strip()
        if len(normalized) <= limit:
            return normalized
        return normalized[: limit - 3].rstrip() + "..."

    def _heuristic_report_draft(self, request: dict[str, Any], transcript: str, predictions: dict[str, Any], clarification: str | None = None) -> dict[str, Any]:
        analysis = self._analyze_report_request(request, transcript, predictions)
        return {
            "draftTitle": self._build_report_title(analysis["reportType"], analysis["policyName"]),
            "draftBody": self._build_report_draft_html(analysis, transcript, predictions),
            "missingFields": analysis["missingFields"],
            "clarification": clarification or "Pude preparar un borrador heurístico, pero conviene revisar datos, fechas y responsables antes de enviarlo.",
            "confidence": float(analysis["confidence"]),
            "modelSource": "heuristic",
            "recommendations": analysis["recommendations"],
            "reportType": analysis["reportType"],
        }

    def form_assist(self, request: dict[str, Any]) -> dict[str, Any]:
        transcript = self._resolve_transcript(request.get("text"), request.get("audioBase64"))
        if not transcript:
            return {
                "transcript": "",
                "source": "empty",
                "confidence": 0.0,
                "modelSource": "tensorflow",
                "suggestedFields": [],
                "missingFields": ["text_or_audio"],
                "clarification": "Necesito texto o audio para interpretar el formulario.",
            }
        history = self._summarize_history([])
        predictions = self.dl_core.predict(transcript, history)
        structured = self.tensor_core.form_assist(transcript, request.get("formFields") or [], request.get("context") or {}, request.get("policyName"))
        suggested_fields_raw = structured.get("suggestedFields") if isinstance(structured.get("suggestedFields"), list) else []
        normalized_suggested_fields: list[dict[str, Any]] = []
        form_fields = request.get("formFields") or []
        form_field_index: dict[str, dict[str, Any]] = {}
        for field in form_fields:
            if isinstance(field, dict):
                field_id = str(field.get("id") or field.get("name") or "").strip()
                field_label = str(field.get("label") or field_id).strip()
                if field_id:
                    form_field_index[field_id.lower()] = field
                if field_label:
                    form_field_index[field_label.lower()] = field

        def _match_form_field(field_id: str, label: str) -> dict[str, Any] | None:
            candidates = [field_id.strip().lower(), label.strip().lower(), field_id.replace("*", "").strip().lower(), label.replace("*", "").strip().lower()]
            for candidate in candidates:
                if candidate and candidate in form_field_index:
                    return form_field_index[candidate]
            return None

        def _canonical_field_key(value: str) -> str:
            return re.sub(r"[^a-z0-9]+", "", value.lower())

        def _field_keys(field_id: str, label: str, matched_field: dict[str, Any] | None = None) -> set[str]:
            keys = {key for key in (_canonical_field_key(field_id), _canonical_field_key(label)) if key}
            if matched_field:
                matched_id = str(matched_field.get("id") or matched_field.get("name") or "").strip()
                matched_label = str(matched_field.get("label") or matched_id).strip()
                keys.update(key for key in (_canonical_field_key(matched_id), _canonical_field_key(matched_label)) if key)
            return keys

        def _semantic_group(field_type: str) -> str:
            if field_type in {"SHORT_TEXT", "LONG_TEXT", "SIGNATURE"}:
                return "text"
            if field_type in {"TABLE", "MATRIX", "GRID"}:
                return "matrix"
            if field_type in {"SINGLE_CHOICE", "MULTIPLE_CHOICE", "RESULT", "CHECKBOX", "CHECKLIST"}:
                return "choice"
            if field_type in {"NUMBER", "DATE"}:
                return "scalar"
            return field_type.lower()

        def _semantic_signature(value: Any) -> str:
            if isinstance(value, (dict, list)):
                return json.dumps(value, ensure_ascii=False, sort_keys=True)
            return re.sub(r"\s+", " ", str(value or "")).strip().lower()

        def _semantic_key(field_type: str, value: Any) -> str:
            return f"{_semantic_group(field_type)}:{_semantic_signature(value)}"

        seen_field_keys: set[str] = set()
        seen_semantic_keys: set[str] = set()

        for item in suggested_fields_raw:
            if not isinstance(item, dict):
                continue
            field_id = str(item.get("fieldId") or item.get("id") or item.get("name") or "").strip()
            label = str(item.get("label") or field_id or "Field").strip()
            field_type = str(item.get("type") or "SHORT_TEXT").upper()
            suggested_value = item.get("suggestedValue")
            if suggested_value is None:
                suggested_value = ""
            matched_field = _match_form_field(field_id, label)
            matched_field_id = str((matched_field or {}).get("id") or field_id or label).strip()
            item_keys = _field_keys(field_id, label, matched_field)
            semantic_key = _semantic_key(field_type, suggested_value)
            if item_keys & seen_field_keys or semantic_key in seen_semantic_keys:
                continue

            normalized_suggested_fields.append(
                {
                    "fieldId": matched_field_id or label,
                    "label": label,
                    "type": field_type,
                    "suggestedValue": suggested_value,
                    "semanticKey": semantic_key,
                    "confidence": float(item.get("confidence") or 0.8),
                    "source": str(item.get("source") or "tensorflow"),
                }
            )
            seen_field_keys.update(item_keys)
            seen_semantic_keys.add(semantic_key)
        for field in form_fields:
            if not isinstance(field, dict):
                continue
            field_id = str(field.get("id") or field.get("name") or "").strip()
            label = str(field.get("label") or field_id).strip()
            if not field_id:
                continue
            field_keys = _field_keys(field_id, label)
            if field_keys & seen_field_keys:
                continue
            context = request.get("context") or {}
            context_value = context.get(field_id)
            if context_value is None and label:
                context_value = context.get(label)
            if context_value is None and str(field.get("required") or "").lower() in {"true", "1"}:
                context_value = field.get("defaultValue")
            if context_value is None:
                continue
            field_type = str(field.get("type") or "SHORT_TEXT").upper()
            semantic_key = _semantic_key(field_type, context_value)
            if semantic_key in seen_semantic_keys:
                continue
            normalized_suggested_fields.append(
                {
                    "fieldId": field_id,
                    "label": label,
                    "type": field_type,
                    "suggestedValue": context_value,
                    "semanticKey": semantic_key,
                    "confidence": 0.92,
                    "source": "context",
                }
            )
            seen_field_keys.update(field_keys)
            seen_semantic_keys.add(semantic_key)

        missing_fields_raw = structured.get("missingFields") if isinstance(structured.get("missingFields"), list) else []
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
        required_missing = [
            str(field.get("id") or field.get("name") or "").strip()
            for field in form_fields
            if isinstance(field, dict) and field.get("required") and str(field.get("id") or field.get("name") or "").strip()
            and not any(entry.get("fieldId") == str(field.get("id") or field.get("name") or "").strip() for entry in normalized_suggested_fields)
        ]
        normalized_missing_fields = list(dict.fromkeys(normalized_missing_fields + required_missing))
        clarification = structured.get("clarification") if isinstance(structured.get("clarification"), str) or structured.get("clarification") is None else None
        if not clarification and normalized_missing_fields:
            clarification = f"Faltan datos para completar: {', '.join(normalized_missing_fields)}."
        return {
            "transcript": transcript,
            "source": "audio" if request.get("audioBase64") else "text",
            "confidence": float(structured.get("confidence") or predictions["confidence"]),
            "modelSource": "tensorflow",
            "suggestedFields": normalized_suggested_fields,
            "missingFields": normalized_missing_fields,
            "clarification": clarification,
        }

    def client_ask(self, request: dict[str, Any]) -> dict[str, Any]:
        transcript = self._resolve_transcript(request.get("text"), request.get("audioBase64"))
        policies = request.get("policies") or []
        
        if not transcript:
            return {
                "suggestedPolicyId": None,
                "answer": "No pude escuchar ni leer tu mensaje. ¿Podés intentar de nuevo?",
                "confidence": 0.0,
                "modelSource": "empty",
                "transcript": ""
            }
            
        payload = {
            "transcript": transcript,
            "availablePolicies": policies,
            "instruction": "Select the best policy from 'availablePolicies' that matches the user's transcript. Return strict JSON with 'suggestedPolicyId' (the id of the chosen policy, or null if none match), and 'answer' (a friendly message helping the user in Spanish)."
        }
        
        system_prompt = (
            "Sos un asistente virtual inteligente diseñado para ayudar a ciudadanos a encontrar el trámite público correcto. "
            "El usuario te enviará su consulta y una lista de trámites disponibles (`availablePolicies`). "
            "Devolvé JSON estricto con las claves: "
            "`suggestedPolicyId` (el ID exacto del trámite que mejor coincida, o null si ninguno sirve), y "
            "`answer` (una respuesta muy amigable, empática y conversacional en español indicando el trámite sugerido o pidiendo más detalles)."
        )
        
        try:
            data, source = self._chat_json(system_prompt, payload)
            return {
                "suggestedPolicyId": data.get("suggestedPolicyId"),
                "answer": data.get("answer") or "No estoy seguro de cuál trámite necesitás. ¿Podés darme más detalles?",
                "confidence": float(data.get("confidence") or 0.8),
                "modelSource": source,
                "transcript": transcript,
            }
        except Exception as e:
            return {
                "suggestedPolicyId": None,
                "answer": f"Hubo un error al procesar tu solicitud con IA: {str(e)}",
                "confidence": 0.0,
                "modelSource": "error",
                "transcript": transcript,
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


def get_ai_runtime(azure_client: AzureOpenAIClient | None = None) -> AICoreRuntime:
    global _runtime
    if _runtime is None:
        _runtime = AICoreRuntime(azure_client=azure_client)
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

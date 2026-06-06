from __future__ import annotations

import os
import re
from typing import Any, Literal


def _normalize_text(value: str | None) -> str:
    return (value or "").strip().lower()


class TensorFlowCoreAdapter:
    def __init__(self) -> None:
        self.provider = os.getenv("AI_CORE_PROVIDER", "fallback").strip().lower()
        self.force_mock = os.getenv("AI_CORE_FORCE_MOCK", "false").strip().lower() == "true"
        self.model_path = os.getenv("AI_CORE_MODEL_PATH", "")
        self._tensorflow_available = False

        if self.provider == "tensorflow":
            if self.force_mock:
                self._tensorflow_available = True
            else:
                try:
                    import tensorflow  # noqa: F401
                    self._tensorflow_available = True
                except Exception:
                    self._tensorflow_available = False

    @property
    def status(self) -> Literal["tensorflow", "fallback"]:
        return "tensorflow" if self._tensorflow_available else "fallback"

    def structured_intake(self, transcript: str, context: dict[str, Any], policy_name: str | None) -> dict[str, Any] | None:
        if self.status != "tensorflow":
            return None

        normalized = _normalize_text(transcript)
        route = self._route_hint(normalized)
        intent = "request" if any(word in normalized for word in ["solicit", "quier", "necesit", "tramite", "reporte", "consulta"]) else "statement"
        policy_assignment = policy_name or f"{route.lower()}-workflow"
        return {
            "structuredFields": {
                "intent": intent,
                "routeHint": route.lower(),
                "summary": transcript[:160],
                "keywords": sorted(set(re.findall(r"[a-záéíóúñ0-9]+", normalized)))[:8],
                "policyName": policy_name,
                "contextSize": len(context),
            },
            "policyAssignment": policy_assignment,
            "suggestedNextAction": f"Assign request to {route} workflow review.",
            "confidence": 0.91,
        }

    def analyst_prediction(self, request_text: str, history_summary: dict[str, Any], anomalies: list[str]) -> dict[str, Any] | None:
        if self.status != "tensorflow":
            return None

        normalized = _normalize_text(request_text)
        route = self._route_hint(normalized)
        risk = "HIGH" if history_summary.get("anomalyScore", 0) >= 0.35 or "demora" in normalized else "NORMAL"
        priority = "URGENT" if "urgente" in normalized else "HIGH" if risk == "HIGH" else "NORMAL"
        recommended_actions = [
            f"Escalate {route} queue review." if risk == "HIGH" else f"Review {route} workload distribution.",
            "Investigate anomaly signals before reassignment." if anomalies else "No anomaly escalation required.",
        ]
        return {
            "route": route,
            "risk": risk,
            "priority": priority,
            "confidence": 0.88,
            "recommendedActions": recommended_actions,
        }

    def report_generation(self, transcript: str, context: dict[str, Any], policy_name: str | None) -> dict[str, Any] | None:
        if self.status != "tensorflow":
            return None

        normalized = _normalize_text(transcript)
        route = self._route_hint(normalized)
        report_type = "operational-risk" if any(word in normalized for word in ["demora", "riesgo", "anomal"]) else "document-trace" if any(word in normalized for word in ["documento", "firma", "evidencia"]) else "general-summary"
        title = f"TensorFlow draft - {policy_name or route.title()}"
        body = "\n".join([
            f"Summary: {transcript}",
            f"Suggested route: {route}",
            f"Report type: {report_type}",
            f"Context keys: {sorted(context.keys())}" if context else "Context keys: []",
            "This draft was produced through the TensorFlow integration path.",
        ])
        return {
            "title": title,
            "body": body,
            "reportType": report_type,
            "confidence": 0.9,
        }

    def form_assist(self, transcript: str, form_fields: list[dict[str, Any]], context: dict[str, Any], policy_name: str | None) -> dict[str, Any] | None:
        if self.status != "tensorflow":
            return None

        normalized = _normalize_text(transcript)
        suggestions: list[dict[str, Any]] = []
        missing: list[str] = []
        for field in form_fields:
            field_id = str(field.get("id") or field.get("name") or "field")
            field_type = str(field.get("type") or "SHORT_TEXT").upper()
            label = str(field.get("label") or field_id)
            required = bool(field.get("required"))
            suggested = self._suggest_value(field_type, label, normalized, field.get("options") or [])
            if suggested is not None:
                suggestions.append({
                    "fieldId": field_id,
                    "label": label,
                    "type": field_type,
                    "suggestedValue": suggested,
                    "confidence": 0.86,
                    "source": "tensorflow",
                })
            elif required:
                missing.append(field_id)
        if context.get("clientName"):
            suggestions.append({
                "fieldId": "clientName",
                "label": "clientName",
                "type": "SHORT_TEXT",
                "suggestedValue": context["clientName"],
                "confidence": 0.92,
                "source": "context",
            })
        if not form_fields and policy_name:
            suggestions.append({
                "fieldId": "policyName",
                "label": "policyName",
                "type": "SHORT_TEXT",
                "suggestedValue": policy_name,
                "confidence": 0.95,
                "source": "context",
            })
        return {
            "suggestedFields": suggestions,
            "missingFields": list(dict.fromkeys(missing)),
            "confidence": 0.89,
        }

    def _route_hint(self, normalized: str) -> str:
        route_map = {
            "LEGAL": ["legal", "jurid", "juicio", "normativa"],
            "FINANCIERO": ["financ", "pago", "factura", "presupuesto"],
            "ATENCION": ["cliente", "reclamo", "consulta"],
            "SOPORTE": ["soporte", "incidente", "error"],
            "RRHH": ["rrhh", "personal", "licencia"],
        }
        for route, keywords in route_map.items():
            if any(keyword in normalized for keyword in keywords):
                return route
        return "GENERAL"

    def _suggest_value(self, field_type: str, label: str, normalized: str, options: list[Any]) -> Any:
        if field_type in {"SHORT_TEXT", "LONG_TEXT"}:
            return normalized[:180] if normalized else None
        if field_type == "NUMBER":
            match = re.search(r"\b(\d+(?:[.,]\d+)?)\b", normalized)
            return match.group(1) if match else None
        if field_type == "DATE":
            match = re.search(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", normalized)
            return match.group(1) if match else None
        if field_type in {"SINGLE_CHOICE", "MULTIPLE_CHOICE", "RESULT"} and options:
            for option in options:
                if _normalize_text(str(option)) in normalized:
                    return option
            return options[0]
        if field_type == "CHECKBOX":
            return any(word in normalized for word in ["si", "sí", "confirmo", "acepto"])
        if field_type == "SIGNATURE":
            return "Signature required"
        return None


def get_tensorflow_core() -> TensorFlowCoreAdapter:
    return TensorFlowCoreAdapter()

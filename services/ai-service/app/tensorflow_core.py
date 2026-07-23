from __future__ import annotations

import json
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

    def structured_intake(self, transcript: str, context: dict[str, Any], policy_name: str | None) -> dict[str, Any]:
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

    def analyst_prediction(self, request_text: str, history_summary: dict[str, Any], anomalies: list[str]) -> dict[str, Any]:
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

    def form_assist(self, transcript: str, form_fields: list[dict[str, Any]], context: dict[str, Any], policy_name: str | None) -> dict[str, Any]:
        normalized = _normalize_text(transcript)
        suggestions: list[dict[str, Any]] = []
        missing: list[str] = []
        for field in form_fields:
            field_id = str(field.get("id") or field.get("name") or "field")
            field_type = str(field.get("type") or "SHORT_TEXT").upper()
            label = str(field.get("label") or field_id)
            required = bool(field.get("required"))
            suggested = self._suggest_value(field, transcript, context)
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

    def _suggest_value(self, field: dict[str, Any], transcript: str, context: dict[str, Any]) -> Any:
        field_type = str(field.get("type") or "SHORT_TEXT").upper()
        label = str(field.get("label") or field.get("id") or "")
        normalized = _normalize_text(transcript)
        options = field.get("options") or []

        if self._is_matrix_like_field(field_type, label, field):
            return self._suggest_matrix_value(field, transcript, context)

        if field_type == "SHORT_TEXT":
            return self._extract_short_text(transcript, label)
        if field_type == "LONG_TEXT":
            return self._extract_long_text(transcript, label)
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

    def _extract_short_text(self, transcript: str, label: str | None = None) -> str | None:
        segments = self._text_segments(transcript)
        if not segments:
            return None

        label_terms = {term for term in re.findall(r"[a-záéíóúñ0-9]+", _normalize_text(label)) if len(term) > 2}
        candidates: list[tuple[int, str]] = []
        for index, segment in enumerate(segments[:4]):
            clean = re.sub(r"\s+", " ", segment or "").strip()
            if not clean:
                continue

            parts = [part.strip() for part in re.split(r"[:\-–—]\s*", clean, maxsplit=1) if part.strip()]
            if len(parts) == 2:
                prefix, suffix = parts
                prefix_words = len(prefix.split())
                suffix_words = len(suffix.split())
                if prefix_words <= 5 and suffix_words:
                    candidates.append((120 - len(suffix), self._trim_text(suffix, 70)))
                if suffix_words <= 5 and prefix:
                    candidates.append((120 - len(prefix), self._trim_text(prefix, 70)))

            lead = re.split(r"[,;]\s*", clean, maxsplit=1)[0].strip()
            if lead:
                score = 100 - len(lead)
                if index == 0:
                    score += 12
                normalized_lead = _normalize_text(lead)
                if any(marker in normalized_lead for marker in ("detalle", "desarrollo", "explica", "porque", "ademas", "además", "contexto")):
                    score -= 25
                if label_terms and any(term in normalized_lead for term in label_terms):
                    score += 10
                candidates.append((score, self._trim_text(lead, 70)))

            candidates.append((80 - len(clean), self._trim_text(clean, 70)))

        if not candidates:
            return None

        best = max(candidates, key=lambda item: (item[0], -len(item[1])))
        candidate = best[1].strip()
        return candidate or None

    def _extract_long_text(self, transcript: str, label: str | None = None) -> str | None:
        segments = self._text_segments(transcript)
        if not segments:
            return None

        short_value = self._extract_short_text(transcript, label)
        detail_markers = ("detalle", "ademas", "además", "porque", "explica", "desarrollo", "descripción", "descripcion", "contexto")
        matrix_markers = ("tabla", "matriz", "grid", "fila", "columna", "row", "column")

        candidates: list[tuple[int, str]] = []
        for index, segment in enumerate(segments):
            clean = re.sub(r"\s+", " ", segment or "").strip()
            if not clean:
                continue

            normalized_clean = _normalize_text(clean)
            score = len(clean)
            if index > 0:
                score += 18
            if len(clean) >= 80:
                score += 30
            if len(clean) < 40:
                score -= 30
            if any(marker in normalized_clean for marker in detail_markers):
                score += 80
            if any(marker in normalized_clean for marker in matrix_markers):
                score -= 60
            candidates.append((score, clean))

        transcript_clean = re.sub(r"\s+", " ", transcript or "").strip()
        if len(transcript_clean) >= 120:
            transcript_normalized = _normalize_text(transcript_clean)
            if not any(marker in transcript_normalized for marker in matrix_markers):
                candidates.append((len(transcript_clean) + 25, transcript_clean))

        if not candidates:
            return None

        for _score, candidate_text in sorted(candidates, key=lambda item: item[0], reverse=True):
            candidate = self._trim_text(candidate_text, 220)
            if not candidate:
                continue
            if short_value and _normalize_text(candidate) == _normalize_text(short_value):
                continue
            if len(candidate) < 60 and not any(marker in _normalize_text(candidate) for marker in detail_markers):
                continue
            return candidate

        return None

    def _is_matrix_like_field(self, field_type: str, label: str, field: dict[str, Any]) -> bool:
        if field_type in {"TABLE", "MATRIX", "GRID"}:
            return True

        normalized_label = _normalize_text(label)
        if any(keyword in normalized_label for keyword in ("matrix", "matriz", "table", "tabla", "grid", "grid", "row", "row", "column", "columna", "scale", "escala")):
            return True

        return bool(field.get("matrixRows") or field.get("tableColumns") or field.get("rows") or field.get("columns"))

    def _suggest_matrix_value(self, field: dict[str, Any], transcript: str, context: dict[str, Any]) -> Any:
        field_id = str(field.get("id") or field.get("name") or "").strip()
        label = str(field.get("label") or field_id).strip()
        rows = self._coerce_text_list(field.get("matrixRows") or field.get("rows") or [])
        columns = self._coerce_text_list(field.get("tableColumns") or field.get("columns") or [])
        context_hint = context.get(field_id) if field_id and field_id in context else None
        if context_hint is None and label:
            context_hint = context.get(label)

        assignments: list[Any] = []
        if isinstance(context_hint, dict):
            for key, value in context_hint.items():
                entry = self._format_matrix_entry(str(key), value)
                if entry:
                    assignments.append(entry)
        elif isinstance(context_hint, list):
            context_text = "; ".join(self._coerce_text_list(context_hint))
            if context_text:
                assignments.append(context_text)
        elif isinstance(context_hint, str) and context_hint.strip():
            assignments.append(context_hint.strip())

        clause_matches = self._extract_matrix_clauses(transcript, rows, columns)
        assignments.extend(clause_matches)

        if not assignments:
            fallback = self._extract_long_text(transcript) or self._extract_short_text(transcript)
            if fallback:
                assignments.append(fallback)

        deduped: list[Any] = []
        seen_signatures: set[str] = set()
        for item in assignments:
            if item is None:
                continue
            if isinstance(item, (dict, list)):
                signature = json.dumps(item, ensure_ascii=False, sort_keys=True)
            else:
                signature = self._trim_text(str(item), 240)
            if not signature or signature in seen_signatures:
                continue
            seen_signatures.add(signature)
            deduped.append(item)
        if not deduped:
            return None

        if any(isinstance(item, dict) for item in deduped):
            return deduped

        return self._trim_text("; ".join(str(item) for item in deduped), 240)

    def _extract_matrix_clauses(self, transcript: str, rows: list[str], columns: list[str]) -> list[Any]:
        normalized = _normalize_text(transcript)
        if not normalized:
            return []

        results: list[Any] = []
        normalized_rows = [(row, _normalize_text(row)) for row in rows if _normalize_text(row)]
        normalized_columns = [(column, _normalize_text(column)) for column in columns if _normalize_text(column)]

        row_matches: list[tuple[int, str, str]] = []
        for row, row_normalized in normalized_rows:
            for match in re.finditer(rf"\b{re.escape(row_normalized)}\b", normalized):
                row_matches.append((match.start(), row, row_normalized))

        row_matches.sort(key=lambda item: item[0])
        if row_matches:
            boundaries = [match[0] for match in row_matches[1:]] + [len(transcript)]
            for index, (start, row, row_normalized) in enumerate(row_matches):
                end = boundaries[index]
                slice_text = transcript[start:end].strip(" ,;:\n\t")
                if not slice_text:
                    continue

                row_value = self._extract_matrix_row_values(slice_text, row, row_normalized, normalized_columns)
                if row_value:
                    results.append(row_value)

        if results:
            return results

        clauses = [part.strip() for part in re.split(r"[\n\.;]+", transcript) if part.strip()]
        fallback: list[Any] = []
        for clause in clauses:
            clause_normalized = _normalize_text(clause)
            value = self._normalize_matrix_cell_value(clause)
            if value is None:
                continue

            row_hits = [row for row in rows if _normalize_text(row) in clause_normalized]
            column_hits = [column for column in columns if _normalize_text(column) in clause_normalized]

            if row_hits or column_hits or any(keyword in clause_normalized for keyword in ("fila", "row", "columna", "column", "matriz", "grid", "table")):
                entry: dict[str, Any] = {}
                if row_hits:
                    entry["rowLabel"] = row_hits[0]
                elif rows:
                    entry["rowLabel"] = self._trim_text(clause, 80)

                if column_hits:
                    entry[column_hits[0]] = value
                elif len(columns) == 1:
                    entry[columns[0][0]] = value
                else:
                    entry["value"] = value

                if entry:
                    fallback.append(entry)

        return fallback

    def _extract_matrix_row_values(self, slice_text: str, row_label: str, row_normalized: str, columns: list[tuple[str, str]]) -> dict[str, Any] | None:
        slice_normalized = _normalize_text(slice_text)
        if not slice_normalized:
            return None

        payload: dict[str, Any] = {}
        if row_label:
            payload["rowLabel"] = row_label

        for column, column_normalized in columns:
            pattern = rf"\b{re.escape(column_normalized)}\b\s*[,;:\-]*\s*([^,.;\n]+)"
            match = re.search(pattern, slice_normalized)
            if match:
                raw_value = self._trim_text(match.group(1), 60)
                normalized_value = self._normalize_matrix_cell_value(raw_value, column)
                payload[column] = normalized_value or raw_value

        if not payload:
            remaining = re.sub(rf"\b{re.escape(row_normalized)}\b", "", slice_text, flags=re.IGNORECASE).strip(" ,;:\n\t")
            if columns:
                numeric_match = re.search(r"\b(\d+(?:[.,]\d+)?)\b", remaining)
                if numeric_match:
                    payload[columns[0][0]] = numeric_match.group(1)
                elif len(columns) == 1:
                    trimmed = self._trim_text(remaining, 60)
                    if trimmed:
                        payload[columns[0][0]] = trimmed
            elif remaining:
                payload[row_normalized or "value"] = self._trim_text(remaining, 60)

        if payload and set(payload.keys()) == {"rowLabel"}:
            return None

        return payload or None

    def _normalize_matrix_cell_value(self, raw_value: str, column_label: str | None = None) -> str | None:
        text = re.sub(r"\s+", " ", raw_value or "").strip()
        if not text:
            return None

        column_normalized = _normalize_text(column_label)
        numeric_match = re.search(r"\b(\d+(?:[.,]\d+)?)\b", text)
        numeric_columns = ("cantidad", "numero", "número", "monto", "importe", "total", "valor", "horas", "dias", "días", "peso", "saldo")
        if numeric_match and (not column_normalized or any(term in column_normalized for term in numeric_columns) or numeric_match.start() <= 1):
            return numeric_match.group(1)

        clause_value = self._matrix_clause_value(_normalize_text(text))
        binary_columns = ("estado", "cumple", "aplica", "resultado", "verificacion", "verificación", "decision", "decisión", "veredicto", "aprobado", "aprobada", "rechazado", "rechazada", "validado", "validada", "confirmado", "confirmada", "cumplido", "cumplida")
        if clause_value == "Pendiente":
            return clause_value
        if clause_value and (not column_normalized or any(term in column_normalized for term in binary_columns) or _normalize_text(text) in {"si", "sí", "no"}):
            return clause_value

        trimmed = self._trim_text(re.split(r"\b(?:y|e|and|con)\b", text, maxsplit=1)[0].strip(), 60)
        if not trimmed:
            trimmed = self._trim_text(text, 60)
        if not trimmed:
            return None
        return trimmed[:1].upper() + trimmed[1:]

    def _matrix_clause_value(self, clause_normalized: str) -> str | None:
        if not clause_normalized:
            return None

        positive_markers = (r"\bsí\b", r"\bsi\b", r"\bok\b", r"\bcumple\b", r"\baplica\b", r"\baprob")
        negative_markers = (r"\bno\b", r"\brechaz", r"\bincomplet", r"\bfalta", r"\bno cumple\b")
        pending_markers = (r"\bpendient", r"\brevis", r"\bpor definir\b", r"\bpending\b")

        if any(re.search(pattern, clause_normalized) for pattern in positive_markers):
            return "Sí"
        if any(re.search(pattern, clause_normalized) for pattern in negative_markers):
            return "No"
        if any(re.search(pattern, clause_normalized) for pattern in pending_markers):
            return "Pendiente"
        return None

    def _text_segments(self, transcript: str) -> list[str]:
        normalized = re.sub(r"\s+", " ", transcript or "").strip()
        if not normalized:
            return []

        segments = [segment.strip(" -:;") for segment in re.split(r"(?<=[.!?])\s+|\n+", normalized) if segment.strip()]
        return segments or [normalized]

    def _trim_text(self, value: str, limit: int) -> str:
        normalized = re.sub(r"\s+", " ", value or "").strip()
        if len(normalized) <= limit:
            return normalized
        return normalized[: limit - 3].rstrip() + "..."

    def _coerce_text_list(self, value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, tuple):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []

    def _format_matrix_entry(self, key: str, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, dict):
            nested = ", ".join(f"{str(nested_key).strip()}: {str(nested_value).strip()}" for nested_key, nested_value in value.items() if str(nested_key).strip() and str(nested_value).strip())
            if nested:
                return f"{key}: {nested}" if key else nested
            return key or None
        if isinstance(value, list):
            joined = ", ".join(str(item).strip() for item in value if str(item).strip())
            if joined:
                return f"{key}: {joined}" if key else joined
            return key or None
        text = str(value).strip()
        if not text:
            return key or None
        return f"{key}: {text}" if key else text


def get_tensorflow_core() -> TensorFlowCoreAdapter:
    return TensorFlowCoreAdapter()

from __future__ import annotations

import base64
from binascii import Error as BinasciiError
from copy import deepcopy
from collections import Counter, defaultdict, deque
import json
import os
import re
from time import perf_counter
from typing import Any, Literal

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.ai_runtime import AzureOpenAIClient, get_ai_runtime
from app.tensorflow_core import get_tensorflow_core


app = FastAPI(title="Policy Design AI Service", version="1.1.0")

LEARNING_STORE: dict[str, list[dict[str, Any]]] = defaultdict(list)
AI_PROVIDER = os.getenv("AI_PROVIDER", "heuristic").strip().lower()
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45"))
AI_NEURAL_MAX_RULE_NODES = int(os.getenv("AI_NEURAL_MAX_RULE_NODES", "80"))

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "").strip()
_AZURE_CLIENT: AzureOpenAIClient | None = None

def _get_azure_client() -> AzureOpenAIClient | None:
    global _AZURE_CLIENT
    if _AZURE_CLIENT is None and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY:
        _AZURE_CLIENT = AzureOpenAIClient(
            endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_KEY,
        )
    return _AZURE_CLIENT

GENERIC_MATCH_TOKENS = {
    "flujo", "flujos", "tarea", "tareas", "paso", "pasos", "revision", "revisiones",
    "aprobacion", "aprobaciones", "paralelo", "paralela", "simultaneo", "simultanea",
    "registro", "tramite", "documento", "documentos", "formulario", "captura", "informacion",
    "proceso", "circuito", "diagrama", "generar", "crear", "realizar", "hacer", "departamento"
}
DEPARTMENT_ALIASES = {
    "financiero": {"finanzas", "finanza"},
    "recursos humanos": {"rrhh", "rh", "talento humano"},
    "legal": {"legales", "juridica", "juridico", "asesoria legal"},
    "atencion": {"atencion al cliente", "cliente", "clientes"},
    "soporte": {"mesa de ayuda", "helpdesk"},
}

import os

cors_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:4200,http://localhost:80,http://localhost")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PolicyDesignRequest(BaseModel):
    policyName: str | None = None
    rules: dict[str, Any] = Field(default_factory=dict)


class AssistantRequest(PolicyDesignRequest):
    prompt: str
    history: list[dict[str, str]] = Field(default_factory=list)
    availableDepartments: list[dict[str, Any]] = Field(default_factory=list)


class CheckResult(BaseModel):
    label: str
    status: Literal["ok", "warning", "error"]
    detail: str


class SimulationReport(BaseModel):
    status: Literal["ok", "warning", "error"]
    durationMs: int
    checkedPaths: int
    errors: list[str]
    warnings: list[str]
    bottlenecks: list[str]
    checks: list[CheckResult]
    recommendations: list[str]


class AssistantResponse(BaseModel):
    answer: str
    recommendations: list[str] = Field(default_factory=list)
    suggestedRules: dict[str, Any] | None = None
    modelSource: Literal["ollama", "heuristic"] = "ollama"


class ExecutionLearningEvent(BaseModel):
    policyName: str | None = None
    taskLabel: str | None = None
    departmentId: str | None = None
    taskType: str | None = None
    durationHours: float = 0
    queueSize: int = 0
    reworkCount: int = 0
    waitingSignatureHours: float = 0
    completed: bool = True


class LearningRequest(BaseModel):
    events: list[ExecutionLearningEvent] = Field(default_factory=list)


class VoiceIntakeRequest(BaseModel):
    text: str | None = None
    audioBase64: str | None = None
    policyName: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class VoiceIntakeResponse(BaseModel):
    transcript: str
    source: Literal["text", "audio", "empty"]
    confidence: float
    modelSource: Literal["tensorflow", "ollama"]
    structuredFields: dict[str, Any]
    policyAssignment: str | None = None
    suggestedNextAction: str | None = None


class AnalystInsightsRequest(BaseModel):
    requestText: str
    history: list[ExecutionLearningEvent] = Field(default_factory=list)
    policyName: str | None = None


class AnalystInsightsResponse(BaseModel):
    route: str
    risk: Literal["LOW", "NORMAL", "HIGH"]
    priority: Literal["LOW", "NORMAL", "HIGH", "URGENT"]
    anomalies: list[str]
    confidence: float
    summary: str
    modelSource: Literal["tensorflow", "ollama"]
    recommendedActions: list[str] = Field(default_factory=list)


class ReportDraftRequest(BaseModel):
    text: str | None = None
    transcript: str | None = None
    audioBase64: str | None = None
    policyName: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class ReportDraftResponse(BaseModel):
    draftTitle: str
    draftBody: str
    missingFields: list[str] = Field(default_factory=list)
    clarification: str | None = None
    confidence: float
    modelSource: Literal["tensorflow", "ollama"]
    reportType: str | None = None


class FormAssistRequest(BaseModel):
    text: str | None = None
    audioBase64: str | None = None
    policyName: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)
    formFields: list[dict[str, Any]] = Field(default_factory=list)

class ClientAskRequest(BaseModel):
    text: str | None = None
    audioBase64: str | None = None
    policies: list[dict[str, Any]] = Field(default_factory=list)

class ClientAskResponse(BaseModel):
    suggestedPolicyId: str | None = None
    answer: str
    confidence: float
    modelSource: str
    transcript: str | None = None


class FormAssistResponse(BaseModel):
    transcript: str
    source: Literal["text", "audio", "empty"]
    confidence: float
    modelSource: Literal["tensorflow", "ollama", "azure", "heuristic"]
    suggestedFields: list[dict[str, Any]]
    missingFields: list[str] = Field(default_factory=list)
    clarification: str | None = None


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Policy Design AI Service is running"}


@app.post("/simulate", response_model=SimulationReport)
def simulate_design(request: PolicyDesignRequest) -> SimulationReport:
    started = perf_counter()
    rules = normalize_rules(request.rules)
    nodes = rules["nodes"]
    connectors = rules["connectors"]
    incoming, outgoing = connector_maps(connectors)

    errors: list[str] = []
    warnings: list[str] = []
    bottlenecks: list[str] = []
    checks: list[CheckResult] = []

    node_types = Counter(node.get("type") for node in nodes)
    start_nodes = [node for node in nodes if node.get("type") == "START"]
    end_nodes = [node for node in nodes if node.get("type") == "END"]
    tasks = [node for node in nodes if node.get("type") == "TASK"]
    gateways = [node for node in nodes if node.get("type") == "GATEWAY"]
    parallels = [node for node in nodes if node.get("type") == "PARALLEL"]
    joins = [node for node in nodes if node.get("type") == "JOIN"]

    structure_errors = []
    if len(start_nodes) != 1:
        structure_errors.append("Debe existir exactamente un nodo Inicio.")
    if not end_nodes:
        structure_errors.append("Debe existir al menos un nodo Fin.")
    if not connectors:
        structure_errors.append("El flujo no tiene conectores.")
    for start in start_nodes:
        if incoming.get(start["id"]):
            structure_errors.append(f"Inicio '{label(start)}' no puede tener entradas.")
        if not outgoing.get(start["id"]):
            structure_errors.append(f"Inicio '{label(start)}' debe tener al menos una salida.")
    for end in end_nodes:
        if outgoing.get(end["id"]):
            structure_errors.append(f"Fin '{label(end)}' no puede tener salidas.")
    checks.append(check("Estructura base", structure_errors, [], f"{len(nodes)} nodos y {len(connectors)} conectores."))
    errors.extend(structure_errors)

    task_errors = []
    task_warnings = []
    decision_fields = set()
    for task in tasks:
        config = task.get("config") or {}
        fields = (((config.get("form") or {}).get("fields")) or [])
        if not task.get("departmentId"):
            task_errors.append(f"Tarea '{label(task)}' no tiene departamento.")
        if not config.get("taskType") or not config.get("estimatedTime"):
            task_errors.append(f"Tarea '{label(task)}' necesita tipo y tiempo estimado.")
        if not fields:
            task_errors.append(f"Tarea '{label(task)}' no tiene formulario operativo.")
        if config.get("requiresSignature") and not any(field.get("type") == "SIGNATURE" for field in fields):
            task_errors.append(f"Tarea '{label(task)}' solicita firma, pero no tiene campo Firma cliente.")
        if len(fields) > 10:
            bottlenecks.append(f"Formulario extenso en '{label(task)}' ({len(fields)} campos).")
        if config.get("requiresSignature"):
            bottlenecks.append(f"'{label(task)}' depende de firma cliente; puede demorar el flujo.")
        learned_risk = learned_task_risk(request.policyName, task)
        if learned_risk:
            bottlenecks.append(learned_risk)
        for field in fields:
            if field.get("usedForDecision") and field.get("id"):
                decision_fields.add(field["id"])
            if not field.get("label"):
                task_errors.append(f"Hay un campo sin etiqueta en '{label(task)}'.")
            if field.get("type") in {"SINGLE_CHOICE", "MULTIPLE_CHOICE", "RESULT"} and not field.get("options"):
                task_errors.append(f"Campo '{field.get('label', 'sin etiqueta')}' necesita opciones.")
    if not tasks:
        task_warnings.append("El flujo no tiene tareas operativas; revisá si realmente representa trabajo de funcionario.")
    checks.append(check("Tareas y formularios", task_errors, task_warnings, f"{len(tasks)} tareas revisadas."))
    errors.extend(task_errors)
    warnings.extend(task_warnings)

    gateway_errors = []
    for gateway in gateways:
        config = gateway.get("config") or {}
        if len(outgoing.get(gateway["id"], [])) < 2:
            gateway_errors.append(f"Decisión '{label(gateway)}' necesita al menos dos salidas.")
        if not config.get("evaluatedField") or not config.get("branches") or not config.get("defaultBranch"):
            gateway_errors.append(f"Decisión '{label(gateway)}' necesita campo evaluado, ramas y camino por defecto.")
        if config.get("evaluatedField") and config.get("evaluatedField") not in decision_fields:
            gateway_errors.append(f"Decisión '{label(gateway)}' evalúa un campo no marcado para decisión.")
    checks.append(check("Decisiones", gateway_errors, [], f"{len(gateways)} decisiones revisadas."))
    errors.extend(gateway_errors)

    parallel_errors = []
    parallel_warnings = []
    for parallel in parallels:
        if not incoming.get(parallel["id"]):
            parallel_errors.append(f"Paralelo '{label(parallel)}' necesita una entrada.")
        if len(outgoing.get(parallel["id"], [])) < 2:
            parallel_errors.append(f"Paralelo '{label(parallel)}' necesita dos o más salidas.")
        if len(outgoing.get(parallel["id"], [])) > 4:
            bottlenecks.append(f"Paralelo '{label(parallel)}' activa {len(outgoing[parallel['id']])} ramas simultáneas.")
    for join in joins:
        if len(incoming.get(join["id"], [])) < 2:
            parallel_errors.append(f"Unión '{label(join)}' necesita dos o más entradas.")
        if not outgoing.get(join["id"]):
            parallel_errors.append(f"Unión '{label(join)}' necesita una salida.")
    if len(parallels) > len(joins):
        parallel_warnings.append("Hay más paralelos que uniones; podría haber ramas sin converger.")
    checks.append(check("Paralelos y uniones", parallel_errors, parallel_warnings, f"{len(parallels)} paralelos y {len(joins)} uniones."))
    errors.extend(parallel_errors)
    warnings.extend(parallel_warnings)

    reachability_warnings = reachability_analysis(nodes, connectors, start_nodes)
    cycle_warnings = cycle_analysis(nodes, connectors)
    warnings.extend(reachability_warnings)
    warnings.extend(cycle_warnings)
    checks.append(check("Cobertura de rutas", [], reachability_warnings + cycle_warnings, "Análisis de alcanzabilidad y ciclos completado."))

    recommendations = build_recommendations(errors, warnings, bottlenecks, node_types)
    status: Literal["ok", "warning", "error"] = "error" if errors else "warning" if warnings or bottlenecks else "ok"

    return SimulationReport(
        status=status,
        durationMs=round((perf_counter() - started) * 1000),
        checkedPaths=len(connectors),
        errors=errors,
        warnings=warnings,
        bottlenecks=bottlenecks,
        checks=checks,
        recommendations=recommendations,
    )


@app.post("/assistant", response_model=AssistantResponse)
def assistant(request: AssistantRequest) -> AssistantResponse:
    rules = normalize_rules(request.rules)
    simulation = simulate_design(PolicyDesignRequest(policyName=request.policyName, rules=rules))
    runtime = get_ai_runtime(azure_client=_get_azure_client())
    try:
        result = runtime.assistant(
            {
                "policyName": request.policyName,
                "prompt": request.prompt,
                "rules": request.rules,
                "history": request.history,
                "availableDepartments": request.availableDepartments,
                "boardContract": assistant_board_contract(rules, simulation),
            },
            simulation.model_dump() if hasattr(simulation, "model_dump") else simulation.dict(),
        )
        runtime_response = assistant_response_from_runtime(result, request)
        if runtime_response:
            return runtime_response
    except Exception:
        pass

    try:
        return assistant_fallback_response(request, rules, simulation)
    except Exception:
        return AssistantResponse(
            answer="El asistente local no pudo usar el runtime, pero mantuve una respuesta segura.",
            recommendations=["Reintentá la consulta o verificá el servicio Ollama."],
            modelSource="heuristic",
        )


def assistant_response_from_runtime(result: Any, request: AssistantRequest) -> AssistantResponse | None:
    if not isinstance(result, dict):
        return None

    answer = str(result.get("answer") or "").strip()
    if not answer:
        return None

    recommendations = result.get("recommendations")
    if isinstance(recommendations, list):
        clean_recommendations = [str(item).strip() for item in recommendations if str(item).strip()]
    else:
        clean_recommendations = []

    model_source = result.get("modelSource")
    if model_source not in {"ollama", "heuristic"}:
        model_source = "ollama"

    suggested_rules = sanitize_suggested_rules(result.get("suggestedRules"), request.policyName, request.rules)
    
    # If Ollama completely failed to generate the structure (empty board) but the user asked for one, trigger heuristic fallback
    if wants_flow_generation(request.prompt) and (not suggested_rules or not suggested_rules.get("nodes")):
        # By returning None here, it forces the caller to use assistant_fallback_response which now contains the from-scratch heuristic
        return None

    # FORCE correct Y coordinates for all nodes based on their assigned department lane
    if suggested_rules and suggested_rules.get("nodes"):
        for node in suggested_rules["nodes"]:
            department_id = node.get("departmentId")
            if department_id:
                node["y"] = lane_y_for_department(suggested_rules, department_id)
        
    return AssistantResponse(
        answer=answer,
        recommendations=clean_recommendations[:8],
        suggestedRules=suggested_rules,
        modelSource=model_source,
    )


def assistant_fallback_response(request: AssistantRequest, rules: dict[str, Any], simulation: SimulationReport) -> AssistantResponse:
    prompt = request.prompt.strip()
    if wants_flow_generation(prompt):
        response = collaborate_existing_flow(request, prompt, simulation)
        if response.suggestedRules is not None:
            response.suggestedRules = sanitize_suggested_rules(response.suggestedRules, request.policyName)
            
            for node in response.suggestedRules.get("nodes") or []:
                department_id = node.get("departmentId")
                if department_id:
                    node["y"] = lane_y_for_department(response.suggestedRules, department_id)
        response.modelSource = "heuristic"
        return response

    return AssistantResponse(
        answer=local_assistant_answer(prompt, simulation),
        recommendations=local_prompt_recommendations(prompt, rules),
        modelSource="heuristic",
    )


def neural_assistant_response(request: AssistantRequest, simulation: SimulationReport) -> AssistantResponse | None:
    if AI_PROVIDER != "ollama":
        return None

    rules = normalize_rules(request.rules)
    if len(rules["nodes"]) > AI_NEURAL_MAX_RULE_NODES:
        return AssistantResponse(
            answer="El asistente neuronal está desactivado para este flujo porque el diagrama es grande. Usé validación determinística para evitar respuestas lentas en esta VM.",
            recommendations=["Dividí el flujo en versiones más pequeñas o subprocesos para mejorar el razonamiento local."],
        )

    system_prompt = (
        "Sos un asistente experto en diseño de trámites públicos, BPMN liviano y formularios operativos. "
        "Respondé en español claro. No inventes departamentos: solo usá los que aparecen en el JSON. "
        "No devuelvas markdown. Devolvé estrictamente JSON con esta forma: "
        "{\"answer\": string, \"recommendations\": string[]} . "
        "Tu trabajo es razonar y explicar; las modificaciones del diagrama las valida el motor determinístico."
    )
    context = {
        "policyName": request.policyName,
        "prompt": request.prompt,
        "history": request.history[-6:],
        "simulation": simulation.dict(),
        "rulesSummary": summarize_rules_for_llm(rules),
    }

    try:
        with httpx.Client(timeout=OLLAMA_TIMEOUT_SECONDS) as client:
            response = client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_ctx": 4096},
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                    ],
                },
            )
            response.raise_for_status()
        content = response.json().get("message", {}).get("content", "").strip()
        data = parse_llm_json(content)
        answer = str(data.get("answer") or "").strip()
        recommendations = [str(item).strip() for item in data.get("recommendations", []) if str(item).strip()]
        if not answer:
            return None
        return AssistantResponse(answer=answer, recommendations=recommendations[:8])
    except Exception as exc:
        return AssistantResponse(
            answer="El modelo neuronal local no respondió a tiempo o no está descargado. Usé el motor heurístico seguro para continuar.",
            recommendations=[
                f"Verificá Ollama y el modelo: {OLLAMA_MODEL}.",
                "En el servidor corré: docker exec -it tuapp-ollama ollama pull qwen2.5:3b-instruct",
                f"Detalle técnico: {type(exc).__name__}",
            ],
        )


def merge_neural_with_heuristic(neural: AssistantResponse | None, heuristic: AssistantResponse) -> AssistantResponse:
    if not neural:
        return heuristic
    recommendations = list(dict.fromkeys((neural.recommendations or []) + (heuristic.recommendations or [])))[:8]
    return AssistantResponse(
        answer=neural.answer,
        recommendations=recommendations,
        suggestedRules=heuristic.suggestedRules,
    )


def assistant_board_contract(rules: dict[str, Any], simulation: SimulationReport) -> dict[str, Any]:
    normalized = normalize_rules(rules)
    nodes = normalized["nodes"]
    departments = list((rules or {}).get("departments") or [])
    task_nodes = [node for node in nodes if str(node.get("type") or "").upper() == "TASK"]
    decision_nodes = [node for node in nodes if str(node.get("type") or "").upper() == "GATEWAY"]
    return {
        "intent": "Return a full board snapshot that can be validated and applied without inventing disconnected elements.",
        "mustKeep": [
            "Use only departments that already exist in the snapshot or add them explicitly before assigning nodes.",
            "Never create connectors that reference unknown node ids.",
            "Never leave a TASK without departmentId, taskType, estimatedTime, and a non-empty form.",
            "Never return a GATEWAY without evaluatedField, branches, defaultBranch, and at least two outgoing connectors.",
            "If you add nodes, connect them to the existing flow.",
            "Do not invent nodes that are not connected to the workflow.",
        ],
        "currentState": {
            "departmentIds": [str(department.get("id") or "") for department in departments if str(department.get("id") or "").strip()],
            "taskCount": len(task_nodes),
            "decisionCount": len(decision_nodes),
            "hasErrors": bool(simulation.errors),
            "hasWarnings": bool(simulation.warnings),
            "bottlenecks": list(simulation.bottlenecks),
        },
        "validNodeTypes": ["START", "TASK", "GATEWAY", "PARALLEL", "JOIN", "END", "OBJECT", "NOTE", "REGION"],
        "validConnectorKinds": ["CONTROL_FLOW", "OBJECT_FLOW"],
    }


def sanitize_suggested_rules(candidate: Any, policy_name: str | None, original_rules: dict[str, Any] | None = None) -> dict[str, Any] | None:
    if not isinstance(candidate, dict):
        return None

    nodes = candidate.get("nodes")
    if not isinstance(nodes, list):
        nodes = []
        
    connectors = candidate.get("connectors")
    if not isinstance(connectors, list):
        connectors = []
        
    # Allow the AI to omit departments, and fallback to the original ones
    departments = candidate.get("departments")
    if departments is None and original_rules is not None:
        departments = original_rules.get("departments", [])
    elif not isinstance(departments, list):
        departments = []

    normalized_candidate: dict[str, Any] = {
        "version": candidate.get("version", 1),
        "departments": departments,
        "laneHeights": candidate.get("laneHeights") if isinstance(candidate.get("laneHeights"), dict) else {},
        "nodes": nodes,
        "connectors": connectors,
    }

    # We do NOT discard the candidate if there are errors anymore.
    # The frontend is responsible for validating the rules and showing explicit error messages to the user.
    # If we return None here, the frontend thinks the AI omitted the structure.
    return normalized_candidate


def parse_llm_json(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}


def summarize_rules_for_llm(rules: dict[str, Any]) -> dict[str, Any]:
    nodes = list(rules.get("nodes") or [])
    connectors = list(rules.get("connectors") or [])
    departments = list(rules.get("departments") or [])
    tasks = [node for node in nodes if node.get("type") == "TASK"]
    return {
        "departments": [{"id": dep.get("id"), "name": dep.get("name"), "active": dep.get("active", True)} for dep in departments],
        "nodesCount": len(nodes),
        "connectorsCount": len(connectors),
        "tasks": [
            {
                "id": task.get("id"),
                "label": task.get("label"),
                "departmentId": task.get("departmentId"),
                "taskType": (task.get("config") or {}).get("taskType"),
                "fields": [
                    {"id": field.get("id"), "type": field.get("type"), "label": field.get("label"), "required": field.get("required")}
                    for field in (((task.get("config") or {}).get("form") or {}).get("fields") or [])
                ],
            }
            for task in tasks[:30]
        ],
    }


@app.post("/learn/execution")
def learn_execution(request: LearningRequest) -> dict[str, Any]:
    for event in request.events:
        key = learning_key(event.policyName)
        LEARNING_STORE[key].append(event.dict())
        LEARNING_STORE[key] = LEARNING_STORE[key][-500:]
    return {"learnedEvents": sum(len(events) for events in LEARNING_STORE.values()), "policies": len(LEARNING_STORE)}


@app.post("/voice/intake", response_model=VoiceIntakeResponse)
def voice_intake(request: VoiceIntakeRequest) -> VoiceIntakeResponse:
    runtime = get_ai_runtime(azure_client=_get_azure_client())
    result = runtime.voice_intake(request.model_dump())
    return VoiceIntakeResponse(**result)


@app.post("/analyst/insights", response_model=AnalystInsightsResponse)
def analyst_insights(request: AnalystInsightsRequest) -> AnalystInsightsResponse:
    runtime = get_ai_runtime(azure_client=_get_azure_client())
    result = runtime.analyst_insights(request.model_dump())
    return AnalystInsightsResponse(**result)


@app.post("/reports/draft", response_model=ReportDraftResponse)
def report_draft(request: ReportDraftRequest) -> ReportDraftResponse:
    runtime = get_ai_runtime(azure_client=_get_azure_client())
    result = runtime.report_draft(request.model_dump())
    return ReportDraftResponse(**result)


@app.post("/form/assist", response_model=FormAssistResponse)
def form_assist(request: FormAssistRequest) -> FormAssistResponse:
    runtime = get_ai_runtime(azure_client=_get_azure_client())
    result = runtime.form_assist(request.model_dump())
    return FormAssistResponse(**result)

@app.post("/client/ask", response_model=ClientAskResponse)
def client_ask(request: ClientAskRequest) -> ClientAskResponse:
    runtime = get_ai_runtime(azure_client=_get_azure_client())
    result = runtime.client_ask(request.model_dump())
    return ClientAskResponse(**result)


def transcribe_input(text: str | None, audio_base64: str | None) -> tuple[str, Literal["text", "audio", "empty"], float]:
    if text and text.strip():
        return text.strip(), "text", 0.98

    if not audio_base64:
        return "", "empty", 0.0

    decoded = decode_audio_payload(audio_base64)
    if decoded:
        return decoded, "audio", 0.72

    return f"Audio recibido ({len(audio_base64)} caracteres base64)", "audio", 0.4


def decode_audio_payload(audio_base64: str) -> str:
    try:
        raw = base64.b64decode(audio_base64, validate=True)
    except (BinasciiError, ValueError):
        return ""

    transcript = raw.decode("utf-8", errors="ignore").strip()
    if transcript:
        return transcript
    return f"Audio de {len(raw)} bytes recibido"


def build_voice_structured_fields(transcript: str, context: dict[str, Any], policy_name: str | None) -> dict[str, Any]:
    route = detect_route(transcript)
    intent = classify_intent(transcript)
    keywords = sorted(token_list(transcript))[:8]
    return {
        "intent": intent,
        "routeHint": route.lower(),
        "summary": transcript[:160],
        "keywords": keywords,
        "policyName": policy_name,
        "contextSize": len(context),
    }


def classify_intent(text: str) -> str:
    normalized = normalize_text(text)
    if any(word in normalized for word in ["necesit", "solicit", "quier", "tramite", "trámite", "report", "denunc", "quie"]):
        return "request"
    return "statement"


def suggest_policy_assignment(structured_fields: dict[str, Any], policy_name: str | None) -> str | None:
    if policy_name:
        return policy_name
    route_hint = str(structured_fields.get("routeHint") or "general").strip().lower()
    return f"{route_hint}-policy-candidate" if route_hint else None


def suggest_next_action(structured_fields: dict[str, Any]) -> str:
    intent = str(structured_fields.get("intent") or "statement")
    route_hint = str(structured_fields.get("routeHint") or "general").upper()
    if intent == "request":
        return f"Review intake and assign workflow for route {route_hint}."
    return "Review transcript and enrich missing business context."


def detect_route(text: str) -> str:
    normalized = normalize_text(text)
    route_map = {
        "LEGAL": ["legal", "juridic", "juicio", "abogado", "normativa"],
        "FINANCIERO": ["financ", "pago", "cobro", "factura", "presupuesto"],
        "ATENCION": ["cliente", "reclamo", "queja", "atencion", "consulta"],
        "SOPORTE": ["soporte", "mesa de ayuda", "helpdesk", "incidente", "error"],
        "RRHH": ["rrhh", "recursos humanos", "personal", "vacacion", "licencia"],
    }
    for route, keywords in route_map.items():
        if any(keyword in normalized for keyword in keywords):
            return route
    return "GENERAL"


def summarize_execution_history(history: list[ExecutionLearningEvent]) -> dict[str, Any]:
    events = [event.model_dump() if hasattr(event, "model_dump") else event.dict() for event in history]
    if not events:
        return {
            "sampleSize": 0,
            "avgQueue": 0.0,
            "avgDuration": 0.0,
            "avgRework": 0.0,
            "avgSignatureWait": 0.0,
            "anomalyScore": 0.0,
            "anomalies": [],
        }

    sample_size = len(events)
    avg_queue = sum(float(event.get("queueSize") or 0) for event in events) / sample_size
    avg_duration = sum(float(event.get("durationHours") or 0) for event in events) / sample_size
    avg_rework = sum(float(event.get("reworkCount") or 0) for event in events) / sample_size
    avg_signature_wait = sum(float(event.get("waitingSignatureHours") or 0) for event in events) / sample_size
    anomaly_flags = [event for event in events if (event.get("queueSize") or 0) >= 8 or (event.get("reworkCount") or 0) >= 3 or (event.get("waitingSignatureHours") or 0) >= 12 or (event.get("durationHours") or 0) >= 12]
    anomaly_score = min(1.0, (avg_queue / 10.0) * 0.35 + (avg_rework / 5.0) * 0.35 + (avg_signature_wait / 24.0) * 0.3)
    return {
        "sampleSize": sample_size,
        "avgQueue": avg_queue,
        "avgDuration": avg_duration,
        "avgRework": avg_rework,
        "avgSignatureWait": avg_signature_wait,
        "anomalyScore": anomaly_score,
        "anomalies": anomaly_flags,
    }


def classify_risk(text: str, history_summary: dict[str, Any]) -> Literal["LOW", "NORMAL", "HIGH"]:
    normalized = normalize_text(text)
    urgent = any(word in normalized for word in ["urgente", "demora", "firma pendiente", "pendiente", "bloqueo", "vencimiento"])
    if urgent and (history_summary["avgQueue"] >= 5 or history_summary["avgRework"] >= 2 or history_summary["anomalyScore"] >= 0.3):
        return "HIGH"
    if history_summary["anomalyScore"] >= 0.45 or history_summary["avgQueue"] >= 7 or history_summary["avgRework"] >= 3:
        return "HIGH"
    if urgent or history_summary["avgQueue"] >= 3:
        return "NORMAL"
    return "LOW"


def classify_priority(text: str, risk: Literal["LOW", "NORMAL", "HIGH"], history_summary: dict[str, Any]) -> Literal["LOW", "NORMAL", "HIGH", "URGENT"]:
    normalized = normalize_text(text)
    if any(word in normalized for word in ["urgente", "inmediato", "ya", "ahora"]):
        return "URGENT"
    if risk == "HIGH" or history_summary["avgQueue"] >= 6 or history_summary["avgSignatureWait"] >= 8:
        return "HIGH"
    if risk == "NORMAL" or history_summary["avgQueue"] >= 3:
        return "NORMAL"
    return "LOW"


def detect_anomalies(text: str, history: list[ExecutionLearningEvent], history_summary: dict[str, Any]) -> list[str]:
    anomalies: list[str] = []
    normalized = normalize_text(text)
    if any(word in normalized for word in ["sin dato", "sin datos", "incompleto", "faltante"]):
        anomalies.append("La solicitud tiene señales de datos incompletos.")
    for event in history:
        queue = float(event.queueSize or 0)
        rework = float(event.reworkCount or 0)
        wait = float(event.waitingSignatureHours or 0)
        duration = float(event.durationHours or 0)
        if queue >= 8:
            anomalies.append(f"Cola alta detectada en {event.departmentId or event.taskLabel or 'un evento'} ({queue:g}).")
        if rework >= 3:
            anomalies.append(f"Retrabajo elevado en {event.departmentId or event.taskLabel or 'un evento'} ({rework:g}).")
        if wait >= 12:
            anomalies.append(f"Espera de firma prolongada en {event.departmentId or event.taskLabel or 'un evento'} ({wait:g}h).")
        if duration >= 12:
            anomalies.append(f"Duración atípica en {event.departmentId or event.taskLabel or 'un evento'} ({duration:g}h).")
    if history_summary["anomalyScore"] >= 0.45:
        anomalies.append("El perfil histórico general muestra una desviación material.")
    return list(dict.fromkeys(anomalies))


def compute_insight_confidence(route: str, history_summary: dict[str, Any], anomalies: list[str]) -> float:
    confidence = 0.45
    if route != "GENERAL":
        confidence += 0.2
    confidence += min(0.25, history_summary["sampleSize"] * 0.05)
    confidence -= min(0.2, len(anomalies) * 0.04)
    return max(0.1, min(0.95, confidence))


def build_analyst_recommendations(route: str, risk: str, priority: str, anomalies: list[str]) -> list[str]:
    recommendations = [f"Review queue ownership for route {route}."]
    if risk == "HIGH":
        recommendations.append("Escalate the procedure to a supervisor or apply a fast-track policy.")
    if priority in {"HIGH", "URGENT"}:
        recommendations.append("Prioritize the next operational task in the department inbox.")
    if anomalies:
        recommendations.append("Inspect anomaly signals before final assignment.")
    return recommendations


def build_report_draft(transcript: str, route: str, priority: Literal["LOW", "NORMAL", "HIGH", "URGENT"], context: dict[str, Any], policy_name: str | None) -> dict[str, str]:
    title = f"Borrador de reporte - {policy_name or route.title()}"
    body_lines = [
        f"Resumen: {transcript}",
        f"Ruta sugerida: {route}",
        f"Prioridad: {priority}",
    ]
    if context:
        body_lines.append(f"Contexto adicional: {json.dumps(context, ensure_ascii=False)}")
    body_lines.append("Revisar campos obligatorios antes de emitir el informe final.")
    return {"title": title, "body": "\n".join(body_lines)}


def infer_report_type(transcript: str) -> str:
    normalized = normalize_text(transcript)
    if any(word in normalized for word in ["demora", "riesgo", "anomal", "cuello"]):
        return "operational-risk"
    if any(word in normalized for word in ["firma", "documento", "evidencia"]):
        return "document-trace"
    return "general-summary"


def suggest_form_fields(transcript: str, form_fields: list[dict[str, Any]], context: dict[str, Any], policy_name: str | None) -> tuple[list[dict[str, Any]], list[str]]:
    normalized = normalize_text(transcript)
    suggestions: list[dict[str, Any]] = []
    missing: list[str] = []
    tokens = token_list(transcript)

    for field in form_fields:
        field_id = str(field.get("id") or field.get("name") or "field")
        label_text = str(field.get("label") or field_id)
        field_type = str(field.get("type") or "SHORT_TEXT").upper()
        required = bool(field.get("required"))
        options = field.get("options") or []
        suggestion = infer_field_value(field_type, label_text, normalized, tokens, options)
        if suggestion is not None:
            suggestions.append({
                "fieldId": field_id,
                "label": label_text,
                "type": field_type,
                "suggestedValue": suggestion,
                "confidence": 0.7 if field_type in {"SHORT_TEXT", "LONG_TEXT"} else 0.62,
                "source": "fallback",
            })
        elif required:
            missing.append(field_id)

    if not form_fields:
        suggestions.append({
                "fieldId": "summary",
                "label": "Resumen",
                "type": "LONG_TEXT",
                "suggestedValue": transcript[:240],
                "confidence": 0.65,
                "source": "fallback",
            })
        if policy_name:
            suggestions.append({
                "fieldId": "policyName",
                "label": "Policy",
                "type": "SHORT_TEXT",
                "suggestedValue": policy_name,
                "confidence": 0.95,
                "source": "context",
            })

    if context and any(key in context for key in ["clientName", "clientCi", "procedureId"]):
        for key in ["clientName", "clientCi", "procedureId"]:
            if key in context and context[key] not in [None, ""]:
                suggestions.append({
                    "fieldId": key,
                    "label": key,
                    "type": "SHORT_TEXT",
                    "suggestedValue": context[key],
                    "confidence": 0.9,
                    "source": "context",
                })

    return suggestions, list(dict.fromkeys(missing))


def infer_field_value(field_type: str, label_text: str, normalized_text: str, tokens: set[str], options: list[Any]) -> Any:
    if field_type in {"SHORT_TEXT", "LONG_TEXT"}:
        if any(word in normalized_text for word in normalize_text(label_text).split() if word):
            return label_text
        return normalized_text[:160] if normalized_text else None
    if field_type == "NUMBER":
        match = re.search(r"\b(\d+(?:[.,]\d+)?)\b", normalized_text)
        return match.group(1) if match else None
    if field_type == "DATE":
        match = re.search(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", normalized_text)
        return match.group(1) if match else None
    if field_type in {"SINGLE_CHOICE", "RESULT", "MULTIPLE_CHOICE"} and options:
        normalized_options = [normalize_text(str(option)) for option in options]
        for option, normalized_option in zip(options, normalized_options):
            if normalized_option and normalized_option in normalized_text:
                return option
        if any(word in normalized_text for word in ["aprobad", "aprobacion", "aprobación"]):
            return options[0]
        if len(options) > 1 and any(word in normalized_text for word in ["observ", "revis", "ajust"]):
            return options[1]
        if len(options) > 2 and any(word in normalized_text for word in ["rechaz", "deneg"]):
            return options[-1]
    if field_type == "CHECKBOX":
        return any(word in normalized_text for word in ["si", "sí", "acepto", "confirmo", "de acuerdo"])
    if field_type == "SIGNATURE":
        return "Firma solicitada"
    return None


def learning_key(policy_name: str | None) -> str:
    return (policy_name or "global").strip().lower() or "global"


def learned_events(policy_name: str | None) -> list[dict[str, Any]]:
    return LEARNING_STORE.get(learning_key(policy_name), []) + LEARNING_STORE.get("global", [])


def learned_task_risk(policy_name: str | None, task: dict[str, Any]) -> str | None:
    events = learned_events(policy_name)
    if not events:
        return None
    department_id = task.get("departmentId")
    task_type = (task.get("config") or {}).get("taskType")
    related = [event for event in events if event.get("departmentId") == department_id or event.get("taskType") == task_type]
    if len(related) < 3:
        return None
    avg_duration = sum(float(event.get("durationHours") or 0) for event in related) / len(related)
    avg_queue = sum(int(event.get("queueSize") or 0) for event in related) / len(related)
    avg_rework = sum(int(event.get("reworkCount") or 0) for event in related) / len(related)
    avg_signature_wait = sum(float(event.get("waitingSignatureHours") or 0) for event in related) / len(related)
    risk_score = avg_duration * 0.35 + avg_queue * 0.25 + avg_rework * 1.5 + avg_signature_wait * 0.25
    if risk_score < 4:
        return None
    return f"Histórico sugiere cuello de botella en '{label(task)}': duración {avg_duration:.1f}h, cola {avg_queue:.1f}, retrabajo {avg_rework:.1f}."


def local_assistant_answer(prompt: str, simulation: SimulationReport) -> str:
    if any(word in prompt for word in ["cuello", "botella", "demora", "lento", "carga", "ticket", "tarea"]):
        return (
            f"Detecté {len(simulation.bottlenecks)} posibles riesgos de cuello de botella. "
            "Cuando el sistema tenga trámites reales, la predicción va a mejorar con tiempos, colas y retrabajos registrados."
        )
    if any(word in prompt for word in ["valid", "revis", "error", "publicar"]):
        return f"Estado del diseño: {simulation.status}. Hay {len(simulation.errors)} errores y {len(simulation.warnings)} advertencias antes de publicar."
    return (
        f"Analicé el diseño actual: estado {simulation.status}. "
        f"Encontré {len(simulation.errors)} errores, {len(simulation.warnings)} advertencias y {len(simulation.bottlenecks)} posibles cuellos de botella."
    )


def local_prompt_recommendations(prompt: str, rules: dict[str, Any]) -> list[str]:
    recommendations: list[str] = []
    departments = list((rules or {}).get("departments") or [])
    if any(word in prompt for word in ["cuello", "botella", "carga", "ticket"]):
        recommendations.append("Para predicción real, registrá duración, cola, retrabajo y espera de firma por tarea ejecutada.")
    if departments:
        recommendations.append(f"El asistente puede adaptar sugerencias a {len(departments)} departamentos cargados en la pizarra.")
    recommendations.append("La predicción mejora cuando existan datos históricos de trámites ejecutados.")
    return recommendations


def wants_flow_generation(prompt: str) -> bool:
    prompt = normalize_text(prompt)
    generation_words = ["gener", "crear", "crea", "arma", "armar", "diagrama", "flujo", "realiza", "realiz", "hacer", "hace", "formulario", "captura"]
    return any(word in prompt for word in generation_words)


def collaborate_existing_flow(request: AssistantRequest, prompt: str, simulation: SimulationReport) -> AssistantResponse:
    context_prompt = prompt_with_correction_context(prompt, request.history)
    current = deepcopy(request.rules or {})
    current.setdefault("version", 1)
    current.setdefault("departments", list((request.rules or {}).get("departments") or []))
    current.setdefault("laneHeights", dict((request.rules or {}).get("laneHeights") or {}))
    current.setdefault("nodes", list((request.rules or {}).get("nodes") or []))
    current.setdefault("connectors", list((request.rules or {}).get("connectors") or []))

    proposed = deepcopy(current)
    changed = False
    
    if not proposed.get("nodes") and not proposed.get("connectors"):
        rules_for_heuristic = request.rules or {}
        if request.availableDepartments:
            rules_for_heuristic["availableDepartments"] = request.availableDepartments
        basic_flow_departments = requested_departments_for_prompt(rules_for_heuristic, prompt)
        if basic_flow_departments:
            changed = True
            
            start_id = "node-start-001"
            end_id = "node-end-001"
            
            proposed["nodes"].append({"id": start_id, "type": "START", "label": "Inicio", "x": 240, "y": lane_y_for_department(proposed, str(basic_flow_departments[0]["id"])), "departmentId": basic_flow_departments[0]["id"]})
            
            prev_id = start_id
            for i, dept in enumerate(basic_flow_departments):
                task_id = f"node-task-{i+1}"
                proposed["nodes"].append({
                    "id": task_id,
                    "type": "TASK",
                    "label": f"Tarea Operativa {dept.get('name', 'General')}",
                    "departmentId": dept["id"],
                    "x": 240 + (i + 1) * 220,
                    "y": lane_y_for_department(proposed, str(dept["id"])),
                    "config": {
                        "taskType": "MANUAL",
                        "estimatedTime": 24,
                        "form": {
                            "title": "Formulario Operativo",
                            "fields": [{"id": f"field_{i}", "type": "TEXT", "label": "Observaciones", "required": True, "order": 1, "visibleToClient": False}]
                        }
                    }
                })
                
                # Check if department is not already in proposed["departments"]
                if not any(d.get("id") == dept["id"] for d in proposed["departments"]):
                    proposed["departments"].append(dept)
                    
                proposed["connectors"].append({"id": f"conn-{prev_id}-{task_id}", "sourceId": prev_id, "targetId": task_id, "type": "CONTROL_FLOW"})
                prev_id = task_id
                
            proposed["nodes"].append({"id": end_id, "type": "END", "label": "Fin", "x": 240 + (len(basic_flow_departments) + 1) * 220, "y": lane_y_for_department(proposed, str(basic_flow_departments[-1]["id"])), "departmentId": basic_flow_departments[-1]["id"]})
            proposed["connectors"].append({"id": f"conn-{prev_id}-{end_id}", "sourceId": prev_id, "targetId": end_id, "type": "CONTROL_FLOW"})
            
            return AssistantResponse(
                answer="Generé un flujo básico secuencial basado en los departamentos que pediste, ya que la pizarra estaba vacía. Podés ajustarlo según necesites.",
                recommendations=["Revisá los formularios operativos de cada tarea.", "Ajustá los tiempos estimados según la carga real."],
                suggestedRules=proposed,
                modelSource="heuristic",
            )
            
    recommendations = simulation.recommendations + flow_improvement_recommendations(prompt, proposed, simulation)

    if any(word in prompt for word in ["firma", "firmar", "cliente"]):
        changed = add_signature_to_last_task(proposed) or changed
        recommendations.insert(0, "Agregué una solicitud de firma al último paso operativo para que el cliente intervenga solo cuando corresponde.") if changed else None

    if any(word in prompt for word in ["decision", "decisión", "dictamen", "resultado", "rama"]):
        changed = ensure_result_field_for_decision(proposed) or changed
        recommendations.insert(0, "Preparé un campo Resultado/Dictamen marcado para decisión en la última tarea operativa.") if changed else None

    if any(word in context_prompt for word in ["paralelo", "paralela", "simultaneo", "simultáneo"]):
        parallel_result = add_parallel_tasks_after_requested_task(proposed, request.rules, context_prompt)
        changed = bool(parallel_result) or changed
        recommendations.insert(0, parallel_result) if parallel_result else None

    if not changed and any(word in prompt for word in ["agrega", "agregá", "anade", "añade", "inclui", "incluí"]) and any(word in prompt for word in ["tarea", "paso", "revision", "revisión"]):
        added_department = add_followup_review_task(proposed, request.rules, prompt)
        changed = bool(added_department) or changed
        recommendations.insert(0, f"Agregué una tarea de revisión en {added_department}, conectada y reacomodada dentro del flujo actual.") if added_department else None

    answer = (
        f"Revisé el flujo actual: estado {simulation.status}. "
        f"Encontré {len(simulation.errors)} errores, {len(simulation.warnings)} advertencias y {len(simulation.bottlenecks)} posibles cuellos de botella."
    )
    if changed:
        answer += " También dejé una propuesta aplicable sobre la pizarra actual, sin partir de cero."
    else:
        answer += " Te dejo sugerencias puntuales para mejorar este flujo sin reemplazarlo."

    return AssistantResponse(
        answer=answer,
        recommendations=list(dict.fromkeys(recommendations))[:8],
        suggestedRules=proposed if changed else None,
    )


def prompt_with_correction_context(prompt: str, history: list[dict[str, str]]) -> str:
    normalized_prompt = normalize_text(prompt)
    correction_markers = ["me referia", "me refería", "quise decir", "corrige", "corregi", "corregí", "no secuencial", "en paralelo"]
    if not any(marker in normalized_prompt for marker in [normalize_text(marker) for marker in correction_markers]):
        return prompt
    previous_user_messages = [message.get("content", "") for message in history if message.get("role") == "user"][-3:]
    return " ".join(previous_user_messages + [prompt]).strip()


def flow_improvement_recommendations(prompt: str, rules: dict[str, Any], simulation: SimulationReport) -> list[str]:
    nodes = list(rules.get("nodes") or [])
    tasks = [node for node in nodes if node.get("type") == "TASK"]
    recommendations: list[str] = []
    if simulation.errors:
        recommendations.append("Primero corregí errores estructurales antes de agregar más pasos; si no, el flujo se vuelve frágil.")
    long_tasks = [task for task in tasks if len((((task.get("config") or {}).get("form") or {}).get("fields") or [])) > 8]
    if long_tasks:
        recommendations.append("Dividí tareas con formularios largos en revisión + dictamen; eso reduce cola y retrabajo.")
    if any(word in prompt for word in ["cuello", "botella", "demora", "lento"]):
        recommendations.append("Para bajar cuellos de botella, separá validaciones documentales de aprobaciones y evitá que firma cliente bloquee etapas internas.")
    if not any(node.get("type") == "GATEWAY" for node in nodes):
        recommendations.append("Si el trámite puede aprobarse, observarse o rechazarse, agregá una Decisión basada en Resultado/Dictamen.")
    if not tasks:
        recommendations.append("El flujo necesita al menos una tarea operativa con formulario para representar trabajo real de funcionario.")
    recommendations.extend(simulation.bottlenecks)
    return recommendations


def add_signature_to_last_task(rules: dict[str, Any]) -> bool:
    task = last_task(rules)
    if not task:
        return False
    config = task.setdefault("config", {})
    form = config.setdefault("form", {"title": f"Formulario {label(task)}", "fields": []})
    fields = form.setdefault("fields", [])
    if any(field.get("type") == "SIGNATURE" for field in fields):
        return False
    fields.append({"id": "firma_cliente", "type": "SIGNATURE", "label": "Firma cliente", "required": True, "order": len(fields) + 1, "visibleToClient": True, "signatureMessage": "Firma requerida para continuar"})
    config["requiresSignature"] = True
    config["notifyClient"] = True
    return True


def ensure_result_field_for_decision(rules: dict[str, Any]) -> bool:
    task = last_task(rules)
    if not task:
        return False
    config = task.setdefault("config", {})
    form = config.setdefault("form", {"title": f"Formulario {label(task)}", "fields": []})
    fields = form.setdefault("fields", [])
    for field in fields:
        if field.get("type") == "RESULT":
            field["usedForDecision"] = True
            return True
    fields.append({"id": "resultado_revision", "type": "RESULT", "label": "Resultado / Dictamen", "required": True, "order": len(fields) + 1, "visibleToClient": True, "usedForDecision": True, "options": ["Aprobado", "Observado", "Rechazado"]})
    return True


def add_parallel_tasks_after_requested_task(rules: dict[str, Any], source_rules: dict[str, Any], prompt: str) -> str | None:
    departments = requested_departments_for_parallel(source_rules, prompt)
    departments = trim_source_department_from_correction(departments, prompt)
    correction_result = restructure_existing_department_tasks_as_parallel(rules, departments, prompt)
    if correction_result:
        return correction_result

    source_task = requested_task_for_prompt(rules, prompt) or last_task(rules)
    if not source_task:
        return None
    if len(departments) == 1:
        source_department = department_by_id(rules, source_task.get("departmentId"))
        if source_department and source_department.get("id") != departments[0].get("id"):
            departments.insert(0, source_department)
    if len(departments) < 2:
        return None

    for department in departments:
        ensure_department_in_rules(rules, department)

    nodes = rules.setdefault("nodes", [])
    connectors = rules.setdefault("connectors", [])
    source_x = int(source_task.get("x") or 0)
    parallel_x = source_x + 240
    task_x = parallel_x + 240
    join_x = task_x + 280
    shift_nodes_after_x(rules, parallel_x, 760)

    outgoing_connectors = [connector for connector in connectors if connector.get("sourceId") == source_task.get("id")]
    original_targets = [connector.get("targetId") for connector in outgoing_connectors if connector.get("targetId")]
    for connector in outgoing_connectors:
        connectors.remove(connector)

    parallel_id = unique_id(nodes, "parallel_ia_revision")
    join_id = unique_id(nodes, "join_ia_revision")
    source_department_id = source_task.get("departmentId") or departments[0].get("id")
    nodes.append({"id": parallel_id, "type": "PARALLEL", "departmentId": source_department_id, "label": "Abrir revisión paralela", "x": parallel_x, "y": int(source_task.get("y") or 40), "config": {"executionMode": "ALL"}})
    connectors.append({"id": unique_id(connectors, "c_ia_source_parallel"), "sourceId": source_task.get("id"), "targetId": parallel_id})

    department_names: list[str] = []
    for index, department in enumerate(departments, start=1):
        department_name = str(department.get("name") or f"Departamento {index}")
        department_names.append(department_name)
        task_id = unique_id(nodes, f"task_ia_parallel_{normalize_text(department_name).replace(' ', '_')}")
        task_label = parallel_task_label(prompt, department_name)
        task_type = "APPROVAL" if any(word in normalize_text(prompt) for word in ["aprobacion", "aprobación", "aprobar", "aprobaciones"]) else "REVISION"
        nodes.append({
            "id": task_id,
            "type": "TASK",
            "departmentId": department.get("id"),
            "label": task_label,
            "x": task_x,
            "y": lane_y_for_department(rules, str(department.get("id") or "")),
            "config": task_config(task_label, task_type),
        })
        connectors.append({"id": unique_id(connectors, f"c_ia_parallel_{task_id}"), "sourceId": parallel_id, "targetId": task_id})
        connectors.append({"id": unique_id(connectors, f"c_ia_{task_id}_join"), "sourceId": task_id, "targetId": join_id})

    nodes.append({"id": join_id, "type": "JOIN", "departmentId": source_department_id, "label": "Unir revisión paralela", "x": join_x, "y": int(source_task.get("y") or 40), "config": {"joinRule": "Todas las tareas paralelas completadas"}})
    for original_target in dict.fromkeys(original_targets):
        connectors.append({"id": unique_id(connectors, "c_ia_join_target"), "sourceId": join_id, "targetId": original_target})

    return f"Preparé una propuesta aplicable: después de '{label(source_task)}' se abre una revisión paralela en {', '.join(department_names)} y luego se vuelve a unir el flujo."


def trim_source_department_from_correction(departments: list[dict[str, Any]], prompt: str) -> list[dict[str, Any]]:
    normalized_prompt = normalize_text(prompt)
    correction_markers = ["me referia", "me refería", "no secuencial", "en paralelo", "seguido de eso", "despues de eso", "después de eso"]
    if len(departments) > 2 and any(normalize_text(marker) in normalized_prompt for marker in correction_markers):
        return departments[1:]
    return departments


def restructure_existing_department_tasks_as_parallel(rules: dict[str, Any], departments: list[dict[str, Any]], prompt: str) -> str | None:
    if len(departments) < 2:
        return None
    nodes = rules.setdefault("nodes", [])
    connectors = rules.setdefault("connectors", [])
    branch_tasks = existing_tasks_for_departments(rules, departments)
    if len(branch_tasks) < 2:
        return None

    branch_ids = {task.get("id") for task in branch_tasks}
    incoming_to_branches = [connector for connector in connectors if connector.get("targetId") in branch_ids and connector.get("sourceId") not in branch_ids]
    outgoing_from_branches = [connector for connector in connectors if connector.get("sourceId") in branch_ids and connector.get("targetId") not in branch_ids]
    if not incoming_to_branches:
        return None
    incoming_sources = {connector.get("sourceId") for connector in incoming_to_branches}
    if len(incoming_sources) == 1:
        incoming_source_node = node_by_id_dict(rules, next(iter(incoming_sources)))
        if incoming_source_node and incoming_source_node.get("type") == "PARALLEL":
            return None

    source_id = incoming_to_branches[0].get("sourceId")
    source_node = node_by_id_dict(rules, source_id)
    if not source_node:
        return None
    original_targets = [connector.get("targetId") for connector in outgoing_from_branches if connector.get("targetId")]

    for connector in list(connectors):
        source_in_branch = connector.get("sourceId") in branch_ids
        target_in_branch = connector.get("targetId") in branch_ids
        if source_in_branch or target_in_branch:
            connectors.remove(connector)

    source_x = int(source_node.get("x") or 0)
    parallel_x = source_x + 240
    task_x = parallel_x + 240
    join_x = task_x + 280
    shift_nodes_after_x(rules, parallel_x, 520)

    parallel_id = unique_id(nodes, "parallel_ia_correction")
    join_id = unique_id(nodes, "join_ia_correction")
    source_department_id = source_node.get("departmentId") or branch_tasks[0].get("departmentId")
    nodes.append({"id": parallel_id, "type": "PARALLEL", "departmentId": source_department_id, "label": "Corregir a paralelo", "x": parallel_x, "y": int(source_node.get("y") or 40), "config": {"executionMode": "ALL"}})
    connectors.append({"id": unique_id(connectors, "c_ia_correction_parallel"), "sourceId": source_id, "targetId": parallel_id})

    department_names: list[str] = []
    for task in branch_tasks:
        department = department_by_id(rules, task.get("departmentId"))
        department_name = str((department or {}).get("name") or task.get("departmentId") or label(task))
        department_names.append(department_name)
        task["x"] = task_x
        task["y"] = lane_y_for_department(rules, str(task.get("departmentId") or ""))
        if any(word in normalize_text(prompt) for word in ["aprobacion", "aprobaci", "aprobar", "aprobaciones"]):
            task.setdefault("config", {})["taskType"] = "APPROVAL"
            if not str(task.get("label") or "").lower().startswith("aprob"):
                task["label"] = f"Aprobación {department_name}"
        connectors.append({"id": unique_id(connectors, f"c_ia_parallel_existing_{task.get('id')}"), "sourceId": parallel_id, "targetId": task.get("id")})
        connectors.append({"id": unique_id(connectors, f"c_ia_existing_{task.get('id')}_join"), "sourceId": task.get("id"), "targetId": join_id})

    nodes.append({"id": join_id, "type": "JOIN", "departmentId": source_department_id, "label": "Unir tareas paralelas", "x": join_x, "y": int(source_node.get("y") or 40), "config": {"joinRule": "Todas las tareas paralelas completadas"}})
    for target_id in dict.fromkeys(original_targets):
        connectors.append({"id": unique_id(connectors, "c_ia_correction_join_target"), "sourceId": join_id, "targetId": target_id})

    return f"Corregí el flujo existente: las tareas de {', '.join(department_names)} ahora salen en paralelo después de '{label(source_node)}' y se vuelven a unir antes de continuar."


def existing_tasks_for_departments(rules: dict[str, Any], departments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tasks = [node for node in list(rules.get("nodes") or []) if node.get("type") == "TASK"]
    result: list[dict[str, Any]] = []
    for department in departments:
        department_id = department.get("id")
        matches = [task for task in tasks if task.get("departmentId") == department_id]
        if matches:
            result.append(sorted(matches, key=lambda task: int(task.get("x") or 0))[0])
    return result


def node_by_id_dict(rules: dict[str, Any], node_id: str | None) -> dict[str, Any] | None:
    if not node_id:
        return None
    for node in list(rules.get("nodes") or []):
        if node.get("id") == node_id:
            return node
    return None


def add_followup_review_task(rules: dict[str, Any], source_rules: dict[str, Any], prompt: str) -> str | None:
    task = last_task(rules)
    if not task:
        return None
    nodes = rules.setdefault("nodes", [])
    connectors = rules.setdefault("connectors", [])
    department = requested_department_for_prompt(source_rules, prompt) or department_by_id(rules, task.get("departmentId"))
    if not department:
        return None
    ensure_department_in_rules(rules, department)
    new_id = unique_id(nodes, "task_revision_ia")
    department_name = str(department.get("name") or "departamento solicitado")
    label_text = f"Revisión {department_name}" if "revision" in prompt or "revisión" in prompt else f"Tarea {department_name}"
    source_x = int(task.get("x") or 0)
    new_x = source_x + 240
    shift_nodes_after_x(rules, new_x, 240)
    new_task = {
        "id": new_id,
        "type": "TASK",
        "departmentId": department.get("id"),
        "label": label_text,
        "x": new_x,
        "y": lane_y_for_department(rules, str(department.get("id") or "")),
        "config": task_config(label_text, "REVISION"),
    }
    target_connector = next((connector for connector in connectors if connector.get("sourceId") == task.get("id")), None)
    if target_connector:
        original_target = target_connector.get("targetId")
        target_connector["targetId"] = new_id
        connectors.append({"id": unique_id(connectors, "c_ia_revision_salida"), "sourceId": new_id, "targetId": original_target})
    else:
        connectors.append({"id": unique_id(connectors, "c_ia_revision"), "sourceId": task.get("id"), "targetId": new_id})
    nodes.append(new_task)
    return department_name


def requested_department_for_prompt(rules: dict[str, Any], prompt: str) -> dict[str, Any] | None:
    departments = requested_departments_for_prompt(rules, prompt)
    return departments[0] if departments else None


def requested_departments_for_parallel(rules: dict[str, Any], prompt: str) -> list[dict[str, Any]]:
    normalized_prompt = normalize_text(prompt)
    marker_positions = [normalized_prompt.find(marker) for marker in ["paralelo", "paralela", "simultaneo", "simultáneo"] if normalized_prompt.find(marker) >= 0]
    if marker_positions:
        suffix = prompt[min(marker_positions):]
        suffix_departments = requested_departments_for_prompt(rules, suffix)
        if suffix_departments:
            return suffix_departments
    for marker in ["seguido de eso", "despues de eso", "después de eso", "luego", "posteriormente"]:
        marker_index = normalized_prompt.rfind(normalize_text(marker))
        if marker_index >= 0:
            tail_departments = requested_departments_for_prompt(rules, prompt[marker_index:])
            if tail_departments:
                return tail_departments
    return requested_departments_for_prompt(rules, prompt)


def requested_departments_for_prompt(rules: dict[str, Any], prompt: str) -> list[dict[str, Any]]:
    candidates = unique_departments(active_departments(list((rules or {}).get("departments") or [])) + active_departments(list((rules or {}).get("availableDepartments") or [])))
    if not candidates:
        return []
    normalized_prompt = normalize_text(prompt)
    name_matches = ranked_department_name_matches(candidates, normalized_prompt)
    if name_matches:
        return name_matches
    return ranked_department_description_matches(candidates, normalized_prompt)


def unique_departments(departments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for department in departments:
        department_id = str(department.get("id") or department.get("name") or "")
        if department_id and department_id not in seen:
            unique.append(department)
            seen.add(department_id)
    return unique


def ranked_department_name_matches(candidates: list[dict[str, Any]], normalized_prompt: str) -> list[dict[str, Any]]:
    prompt_tokens = meaningful_tokens(normalized_prompt)
    prompt_token_list = token_list(normalized_prompt)
    scored: list[tuple[int, int, int, dict[str, Any]]] = []
    for index, department in enumerate(candidates):
        score = department_name_score(department, normalized_prompt, prompt_tokens, prompt_token_list)
        if score > 0:
            scored.append((department_match_position(department, normalized_prompt), -score, index, department))
    ordered = [department for _, _, _, department in sorted(scored, key=lambda item: (item[0], item[1], item[2]))]
    return prune_less_specific_matches(ordered, normalized_prompt)


def department_match_position(department: dict[str, Any], normalized_prompt: str) -> int:
    candidates = [normalize_text(str(department.get("name") or "")).strip(), normalize_text(str(department.get("id") or "")).strip()]
    name = candidates[0]
    candidates.extend(DEPARTMENT_ALIASES.get(name, set()))
    positions = [normalized_prompt.find(candidate) for candidate in candidates if candidate and normalized_prompt.find(candidate) >= 0]
    return min(positions) if positions else 10_000


def ranked_department_description_matches(candidates: list[dict[str, Any]], normalized_prompt: str) -> list[dict[str, Any]]:
    prompt_tokens = meaningful_tokens(normalized_prompt) - GENERIC_MATCH_TOKENS
    scored: list[tuple[int, int, dict[str, Any]]] = []
    for index, department in enumerate(candidates):
        description_tokens = meaningful_tokens(str(department.get("description") or "")) - GENERIC_MATCH_TOKENS
        overlap = description_tokens & prompt_tokens
        if len(overlap) >= 2:
            scored.append((len(overlap), index, department))
    if not scored:
        return []
    best = max(score for score, _, _ in scored)
    return [department for score, _, department in sorted(scored, key=lambda item: (-item[0], item[1])) if score == best]


def department_name_score(department: dict[str, Any], normalized_prompt: str, prompt_tokens: set[str], prompt_token_list: list[str]) -> int:
    name = normalize_text(str(department.get("name") or "")).strip()
    department_id = normalize_text(str(department.get("id") or "")).strip()
    name_tokens = meaningful_tokens(name)
    id_tokens = meaningful_tokens(department_id)
    aliases = DEPARTMENT_ALIASES.get(name, set()) | DEPARTMENT_ALIASES.get(department_id, set())
    if department_id and phrase_in_tokens(token_list(department_id), prompt_token_list):
        return 90 + len(id_tokens)
    if name and phrase_in_tokens(token_list(name), prompt_token_list):
        return 80 + len(name_tokens)
    for alias in aliases:
        alias_tokens = token_list(alias)
        if phrase_in_tokens(alias_tokens, prompt_token_list):
            return 75 + len(alias_tokens)
    if name_tokens and name_tokens.issubset(prompt_tokens):
        return 60 + len(name_tokens)
    overlap = name_tokens & prompt_tokens
    if len(overlap) == 1 and next(iter(overlap)) not in GENERIC_MATCH_TOKENS:
        return 25
    return 0


def prune_less_specific_matches(matches: list[dict[str, Any]], normalized_prompt: str) -> list[dict[str, Any]]:
    pruned: list[dict[str, Any]] = []
    prompt_tokens = token_list(normalized_prompt)
    matched_names = [normalize_text(str(department.get("name") or "")).strip() for department in matches]
    for department, name in zip(matches, matched_names):
        name_tokens = set(token_list(name))
        is_less_specific = False
        for other in matched_names:
            other_tokens = set(token_list(other))
            if name != other and name_tokens and name_tokens < other_tokens and phrase_in_tokens(token_list(other), prompt_tokens):
                is_less_specific = True
                break
        if not is_less_specific:
            pruned.append(department)
    return pruned


def phrase_in_tokens(phrase_tokens: list[str], prompt_tokens: list[str]) -> bool:
    if not phrase_tokens:
        return False
    size = len(phrase_tokens)
    return any(prompt_tokens[index:index + size] == phrase_tokens for index in range(0, len(prompt_tokens) - size + 1))


def token_list(value: str) -> list[str]:
    ignored = {"de", "del", "la", "el", "los", "las", "y", "e"}
    return [token for token in clean_token_text(value).split() if len(token) > 1 and token not in ignored]


def requested_task_for_prompt(rules: dict[str, Any], prompt: str) -> dict[str, Any] | None:
    tasks = [node for node in list((rules or {}).get("nodes") or []) if node.get("type") == "TASK"]
    normalized_prompt = normalize_text(prompt)
    prompt_tokens = meaningful_tokens(normalized_prompt)
    best_task = None
    best_score = 0
    for task in tasks:
        label_tokens = meaningful_tokens(str(task.get("label") or ""))
        score = len(label_tokens & prompt_tokens)
        normalized_label = normalize_text(str(task.get("label") or ""))
        if normalized_label and normalized_label in normalized_prompt:
            score += 3
        if score > best_score:
            best_score = score
            best_task = task
    return best_task if best_score > 0 else None


def parallel_task_label(prompt: str, department_name: str) -> str:
    normalized_prompt = normalize_text(prompt)
    if "aprobacion" in normalized_prompt or "aprobar" in normalized_prompt or "aprobaciones" in normalized_prompt:
        return f"Aprobación {department_name}"
    if "check" in normalized_prompt or "cheque" in normalized_prompt:
        return f"Check {department_name}"
    if "registro" in normalized_prompt:
        return f"Registro {department_name}"
    if "revision" in normalized_prompt or "revisión" in prompt.lower():
        return f"Revisión {department_name}"
    return f"Tarea {department_name}"


def department_by_id(rules: dict[str, Any], department_id: str | None) -> dict[str, Any] | None:
    if not department_id:
        return None
    for department in list((rules or {}).get("departments") or []):
        if department.get("id") == department_id:
            return department
    return None


def ensure_department_in_rules(rules: dict[str, Any], department: dict[str, Any]) -> None:
    departments = rules.setdefault("departments", [])
    department_id = department.get("id")
    if department_id and not any(item.get("id") == department_id for item in departments):
        departments.append(department)
    lane_heights = rules.setdefault("laneHeights", {})
    if department_id and not lane_heights.get(department_id):
        lane_heights[department_id] = 140


def lane_y_for_department(rules: dict[str, Any], department_id: str) -> int:
    y = 0
    lane_heights = rules.get("laneHeights") or {}
    for department in list(rules.get("departments") or []):
        height = int(lane_heights.get(department.get("id"), 140) or 140)
        if department.get("id") == department_id:
            return y + 80
        y += height
    return y + 80


def shift_nodes_after_x(rules: dict[str, Any], min_x: int, delta: int) -> None:
    for node in list(rules.get("nodes") or []):
        try:
            node_x = int(node.get("x") or 0)
        except (TypeError, ValueError):
            node_x = 0
        if node_x >= min_x:
            node["x"] = node_x + delta


def unique_id(items: list[dict[str, Any]], base: str) -> str:
    existing = {item.get("id") for item in items}
    if base not in existing:
        return base
    index = 2
    while f"{base}_{index}" in existing:
        index += 1
    return f"{base}_{index}"


def last_task(rules: dict[str, Any]) -> dict[str, Any] | None:
    tasks = [node for node in list(rules.get("nodes") or []) if node.get("type") == "TASK"]
    return tasks[-1] if tasks else None


def adaptive_rules(policy_name: str, current_rules: dict[str, Any], prompt: str) -> dict[str, Any] | None:
    current_departments = active_departments(list((current_rules or {}).get("departments") or []))
    available_departments = active_departments(list((current_rules or {}).get("availableDepartments") or []))
    source_departments = available_departments or current_departments
    departments = requested_departments_for_prompt({"availableDepartments": source_departments}, prompt)
    if not departments and current_departments:
        departments = current_departments
    if not departments:
        return None

    wants_signature = any(word in prompt for word in ["firma", "firmar", "cliente"])
    wants_decision = any(word in prompt for word in ["aprobar", "aprobacion", "aprobación", "rechazar", "decision", "decisión", "observado"])
    wants_parallel = any(word in prompt for word in ["paralelo", "paralela", "simultaneo", "simultáneo", "varios", "2 tareas", "dos tareas", "una para", "otra para", "una en", "otra en"])
    wants_approval = any(word in prompt for word in ["aprobacion", "aprobación", "aprobar", "aprobacion", "aprobaciones"])

    lane_heights = {department["id"]: 140 for department in departments}
    nodes: list[dict[str, Any]] = []
    connectors: list[dict[str, Any]] = []

    def y_for(index: int) -> int:
        return index * 140 + 40

    first = departments[0]
    nodes.append({"id": "start", "type": "START", "departmentId": first["id"], "label": "Inicio", "x": 240, "y": y_for(0), "config": {"initialStatus": "RECIBIDO", "startCondition": "Trámite creado por funcionario"}})
    nodes.append({"id": "task_registro", "type": "TASK", "departmentId": first["id"], "label": "Registro del trámite", "x": 460, "y": y_for(0), "config": task_config(policy_name, "DOCUMENTAL", wants_signature=False, decision_field=wants_decision)})
    connectors.append({"id": "c_start_registro", "sourceId": "start", "targetId": "task_registro"})

    previous = "task_registro"
    x = 700
    if wants_parallel and len(departments) >= 2:
        nodes.append({"id": "parallel", "type": "PARALLEL", "departmentId": first["id"], "label": "Enviar a revisiones", "x": x, "y": y_for(0), "config": {"executionMode": "ALL"}})
        connectors.append({"id": "c_registro_parallel", "sourceId": previous, "targetId": "parallel"})
        join_id = "join_revisiones"
        branch_departments = departments[1:] if len(departments) > 2 else departments
        for index, department in enumerate(branch_departments, start=1):
            task_id = f"task_revision_{index}"
            branch_type = "APPROVAL" if wants_approval else "REVISION"
            nodes.append({"id": task_id, "type": "TASK", "departmentId": department["id"], "label": f"{task_type_label(branch_type)} {department.get('name', index)}", "x": x + 240, "y": y_for(index), "config": task_config(policy_name, branch_type)})
            connectors.append({"id": f"c_parallel_{task_id}", "sourceId": "parallel", "targetId": task_id})
            connectors.append({"id": f"c_{task_id}_join", "sourceId": task_id, "targetId": join_id})
        nodes.append({"id": join_id, "type": "JOIN", "departmentId": first["id"], "label": "Unir revisiones", "x": x + 500, "y": y_for(0), "config": {"joinRule": "Todas las revisiones completadas"}})
        previous = join_id
        x += 760
    else:
        for index, department in enumerate(departments[1:], start=1):
            task_id = f"task_{index}"
            task_type = "APPROVAL" if index == len(departments) - 1 else "REVISION"
            nodes.append({"id": task_id, "type": "TASK", "departmentId": department["id"], "label": f"{task_type_label(task_type)} {department.get('name', index)}", "x": x, "y": y_for(index), "config": task_config(policy_name, task_type, wants_signature and index == len(departments) - 1)})
            connectors.append({"id": f"c_{previous}_{task_id}", "sourceId": previous, "targetId": task_id})
            previous = task_id
            x += 240

    if wants_decision:
        decision_id = "decision_resultado"
        nodes.append({"id": decision_id, "type": "GATEWAY", "departmentId": departments[-1]["id"], "label": "¿Resultado aprobado?", "x": x, "y": y_for(len(departments) - 1), "config": {"evaluatedField": "resultado_revision", "conditionType": "SELECTION", "branches": "Aprobado → Fin aprobado\nRechazado → Fin rechazado\nObservado → Registro del trámite", "defaultBranch": "Fin aprobado"}})
        connectors.append({"id": f"c_{previous}_{decision_id}", "sourceId": previous, "targetId": decision_id})
        previous = decision_id
        x += 240

    end_department = first if wants_parallel else departments[-1]
    end_y = y_for(0) if wants_parallel else y_for(len(departments) - 1)
    nodes.append({"id": "end_ok", "type": "END", "departmentId": end_department["id"], "label": "Fin aprobado", "x": x, "y": end_y, "config": {"finalStatus": "COMPLETED", "customerMessage": "Trámite completado"}})
    connectors.append({"id": f"c_{previous}_end_ok", "sourceId": previous, "targetId": "end_ok"})
    if wants_decision:
        nodes.append({"id": "end_rejected", "type": "END", "departmentId": first["id"], "label": "Fin rechazado", "x": x, "y": y_for(0), "config": {"finalStatus": "REJECTED", "customerMessage": "Trámite rechazado"}})
        connectors.append({"id": "c_decision_rejected", "sourceId": "decision_resultado", "targetId": "end_rejected"})

    return {"version": 1, "departments": departments, "laneHeights": lane_heights, "nodes": nodes, "connectors": connectors}


def task_config(policy_name: str, task_type: str, wants_signature: bool = False, decision_field: bool = False) -> dict[str, Any]:
    fields = [
        {"id": "observacion", "type": "LONG_TEXT", "label": "Observación", "required": False, "order": 1},
    ]
    if decision_field:
        fields.append({"id": "resultado_revision", "type": "RESULT", "label": "Resultado de revisión", "required": True, "order": 2, "usedForDecision": True, "options": ["Aprobado", "Observado", "Rechazado"]})
    if wants_signature:
        fields.append({"id": "firma_cliente", "type": "SIGNATURE", "label": "Firma cliente", "required": True, "order": len(fields) + 1, "signatureMessage": "Firma requerida para continuar"})
    return {"taskType": task_type, "priority": "NORMAL", "requiresSignature": wants_signature, "estimatedTime": "4 horas", "visibleToClient": True, "notifyClient": wants_signature, "form": {"title": f"Formulario {policy_name}", "fields": fields}}


def task_type_label(task_type: str) -> str:
    return "Aprobación" if task_type == "APPROVAL" else "Revisión"


def select_departments_for_prompt(departments: list[dict[str, Any]], prompt: str) -> list[dict[str, Any]]:
    if not departments:
        return []
    mentioned = requested_departments_for_prompt({"availableDepartments": departments}, prompt)
    return mentioned if mentioned else departments


def prompt_mentions_department(departments: list[dict[str, Any]], prompt: str) -> bool:
    return bool(requested_departments_for_prompt({"availableDepartments": departments}, prompt))


def active_departments(departments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [department for department in departments if department.get("active") is not False]


def department_matches_prompt(department: dict[str, Any], normalized_prompt: str, prompt_tokens: set[str]) -> bool:
    return department_name_matches_prompt(department, normalized_prompt, prompt_tokens) or department_description_matches_prompt(department, prompt_tokens)


def department_name_matches_prompt(department: dict[str, Any], normalized_prompt: str, prompt_tokens: set[str]) -> bool:
    return department_name_score(department, normalized_prompt, prompt_tokens, token_list(normalized_prompt)) > 0


def department_description_matches_prompt(department: dict[str, Any], prompt_tokens: set[str]) -> bool:
    description_tokens = meaningful_tokens(str(department.get("description") or "")) - GENERIC_MATCH_TOKENS
    return len(description_tokens & (prompt_tokens - GENERIC_MATCH_TOKENS)) >= 2


def missing_departments_in_prompt(rules: dict[str, Any], prompt: str) -> list[str]:
    available = active_departments(list((rules or {}).get("availableDepartments") or []) or list((rules or {}).get("departments") or []))
    normalized_prompt = normalize_text(prompt)
    requested = extract_requested_department_names(normalized_prompt)
    if not requested:
        return []
    missing = []
    for name in requested:
        tokens = meaningful_tokens(name)
        exists = any(department_matches_prompt(department, name, tokens) for department in available)
        if not exists:
            missing.append(name.title())
    return missing


def extract_requested_department_names(normalized_prompt: str) -> list[str]:
    markers = ["departamento de ", "departamento ", "area de ", "area "]
    found: list[str] = []
    for marker in markers:
        start = 0
        while marker in normalized_prompt[start:]:
            index = normalized_prompt.index(marker, start) + len(marker)
            tail = normalized_prompt[index:]
            stop = len(tail)
            for separator in [".", ",", ";", " y ", " e ", " con ", " para "]:
                separator_index = tail.find(separator)
                if separator_index >= 0:
                    stop = min(stop, separator_index)
            candidate = tail[:stop].strip()
            if candidate and meaningful_tokens(candidate):
                found.append(candidate)
            start = index
    return list(dict.fromkeys(found))


def meaningful_tokens(value: str) -> set[str]:
    ignored = {"departamento", "departamentos", "area", "areas", "de", "del", "la", "el", "los", "las", "para", "por", "con", "en", "un", "una", "y", "e"}
    return {token for token in clean_token_text(value).split() if len(token) > 2 and token not in ignored}


def normalize_text(value: str) -> str:
    replacements = str.maketrans("áéíóúüñ", "aeiouun")
    return value.lower().translate(replacements)


def clean_token_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", normalize_text(value))


def normalize_rules(rules: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    return {
        "nodes": list(rules.get("nodes") or []),
        "connectors": list(rules.get("connectors") or []),
    }


def connector_maps(connectors: list[dict[str, Any]]) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    incoming: dict[str, list[str]] = defaultdict(list)
    outgoing: dict[str, list[str]] = defaultdict(list)
    for connector in connectors:
        source = connector.get("sourceId")
        target = connector.get("targetId")
        if source and target:
            outgoing[source].append(target)
            incoming[target].append(source)
    return incoming, outgoing


def label(node: dict[str, Any]) -> str:
    return node.get("label") or node.get("type") or "Nodo"


def check(label_: str, errors: list[str], warnings: list[str], ok_detail: str) -> CheckResult:
    if errors:
        return CheckResult(label=label_, status="error", detail=errors[0])
    if warnings:
        return CheckResult(label=label_, status="warning", detail=warnings[0])
    return CheckResult(label=label_, status="ok", detail=ok_detail)


def reachability_analysis(nodes: list[dict[str, Any]], connectors: list[dict[str, Any]], starts: list[dict[str, Any]]) -> list[str]:
    if not starts:
        return []
    _, outgoing = connector_maps(connectors)
    visited = set()
    queue = deque([starts[0].get("id")])
    while queue and len(visited) <= len(nodes) + len(connectors):
        current = queue.popleft()
        if not current or current in visited:
            continue
        visited.add(current)
        queue.extend(outgoing.get(current, []))
    unreachable = [label(node) for node in nodes if node.get("id") not in visited]
    return [f"Nodos no alcanzables desde Inicio: {', '.join(unreachable)}."] if unreachable else []


def cycle_analysis(nodes: list[dict[str, Any]], connectors: list[dict[str, Any]]) -> list[str]:
    _, outgoing = connector_maps(connectors)
    node_ids = {node.get("id") for node in nodes}
    visiting: set[str] = set()
    visited: set[str] = set()

    def dfs(node_id: str | None) -> bool:
        if not node_id or node_id not in node_ids:
            return False
        if node_id in visiting:
            return True
        if node_id in visited:
            return False
        visiting.add(node_id)
        for target in outgoing.get(node_id, []):
            if dfs(target):
                return True
        visiting.remove(node_id)
        visited.add(node_id)
        return False

    has_cycle = any(dfs(node.get("id")) for node in nodes)
    return ["Se detectó al menos un ciclo. Si es intencional, debe tener condición clara de salida."] if has_cycle else []


def build_recommendations(errors: list[str], warnings: list[str], bottlenecks: list[str], node_types: Counter) -> list[str]:
    recommendations = []
    if errors:
        recommendations.append("Corregí primero los errores; no publiques hasta que el estado sea OK o solo tenga advertencias aceptadas.")
    if node_types.get("GATEWAY", 0) and not errors:
        recommendations.append("Validá manualmente que cada rama de Decisión coincida con el nombre del nodo destino.")
    if bottlenecks:
        recommendations.append("Dividí tareas con formularios extensos o firmas en pasos más pequeños para reducir demoras.")
    if not recommendations:
        recommendations.append("El diseño está listo para una prueba operativa controlada con funcionario.")
    return recommendations

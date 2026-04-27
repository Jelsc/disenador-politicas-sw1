package com.tuapp.backend.policies.operation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tuapp.backend.policies.application.PolicyService;
import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;

@Service
public class ProcedureOperationService {
    private final PolicyService policyService;
    private final UserRepository userRepository;
    private final ProcedureMongoRepository procedureRepository;
    private final ProcedureTaskMongoRepository taskRepository;
    private final ObjectMapper objectMapper;

    public ProcedureOperationService(PolicyService policyService, UserRepository userRepository, ProcedureMongoRepository procedureRepository, ProcedureTaskMongoRepository taskRepository, ObjectMapper objectMapper) {
        this.policyService = policyService;
        this.userRepository = userRepository;
        this.procedureRepository = procedureRepository;
        this.taskRepository = taskRepository;
        this.objectMapper = objectMapper;
    }

    public List<Policy> startablePolicies(String username) {
        List<String> departments = userDepartments(username);
        return policyService.getPublishedPoliciesForExecution().stream()
                .filter(policy -> departments.contains(startDepartmentId(policy)))
                .toList();
    }

    public ProcedureDocument createProcedure(CreateProcedureRequest request, String username) {
        Policy policy = policyService.getPublishedPolicyForExecution(request.getPolicyId());
        String startDepartmentId = startDepartmentId(policy);
        if (!userDepartments(username).contains(startDepartmentId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No podés iniciar este trámite porque empieza en otro departamento.");
        }
        LocalDateTime now = LocalDateTime.now();
        ProcedureDocument procedure = procedureRepository.save(ProcedureDocument.builder()
                .policyId(policy.getId())
                .policyName(policy.getName())
                .status("OPEN")
                .createdBy(username)
                .startDepartmentId(startDepartmentId)
                .values(request.getValues() == null ? new HashMap<>() : request.getValues())
                .createdAt(now)
                .updatedAt(now)
                .build());
        JsonNode start = firstNode(policy, "START");
        if (start != null) activateNext(policy, procedure, start.path("id").asText(), new HashSet<>());
        return procedure;
    }

    public List<ProcedureTaskDocument> departmentInbox(String username) {
        return taskRepository.findByDepartmentIdInAndStatusOrderByCreatedAtAsc(userDepartments(username), "PENDING");
    }

    public List<ProcedureTaskDocument> myTasks(String username) {
        return taskRepository.findByAssignedToAndStatusOrderByAssignedAtAsc(username, "ASSIGNED");
    }

    public ProcedureTaskDocument acceptTask(String taskId, String username) {
        ProcedureTaskDocument task = requireTask(taskId);
        if (!"PENDING".equals(task.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT, "La tarea ya fue tomada.");
        if (!userDepartments(username).contains(task.getDepartmentId())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La tarea pertenece a otro departamento.");
        task.setStatus("ASSIGNED");
        task.setAssignedTo(username);
        task.setAssignedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }

    public ProcedureTaskDocument completeTask(String taskId, CompleteTaskRequest request, String username) {
        ProcedureTaskDocument task = requireTask(taskId);
        if (!username.equals(task.getAssignedTo())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo quien aceptó la tarea puede completarla.");
        task.setStatus("COMPLETED");
        task.setFormValues(request.getValues() == null ? new HashMap<>() : request.getValues());
        task.setCompletedAt(LocalDateTime.now());
        ProcedureTaskDocument saved = taskRepository.save(task);
        ProcedureDocument procedure = procedureRepository.findById(task.getProcedureId()).orElseThrow();
        if (procedure.getValues() == null) procedure.setValues(new HashMap<>());
        procedure.getValues().putAll(saved.getFormValues());
        procedure.setUpdatedAt(LocalDateTime.now());
        procedureRepository.save(procedure);
        Policy policy = policyService.getPublishedPolicyForExecution(task.getPolicyId());
        activateNext(policy, procedure, task.getNodeId(), new HashSet<>());
        return saved;
    }

    public List<ProcedureDocument> myProcedures(String username) {
        return procedureRepository.findByCreatedByOrderByCreatedAtDesc(username);
    }

    public List<Map<String, Object>> learningEvents() {
        return taskRepository.findByStatusOrderByCompletedAtDesc("COMPLETED").stream()
                .limit(500)
                .map(this::toLearningEvent)
                .toList();
    }

    private void activateNext(Policy policy, ProcedureDocument procedure, String nodeId, Set<String> visited) {
        if (!visited.add(nodeId) || visited.size() > 80) return;
        JsonNode rules = rules(policy);
        for (JsonNode connector : rules.path("connectors")) {
            if (!nodeId.equals(connector.path("sourceId").asText())) continue;
            JsonNode target = nodeById(rules, connector.path("targetId").asText());
            if (target == null) continue;
            String type = target.path("type").asText();
            if ("TASK".equals(type)) createPendingTask(policy, procedure, target);
            else if ("END".equals(type)) closeProcedure(procedure, target);
            else if ("GATEWAY".equals(type)) activateGateway(policy, procedure, target, visited);
            else activateNext(policy, procedure, target.path("id").asText(), visited);
        }
    }

    private void activateGateway(Policy policy, ProcedureDocument procedure, JsonNode gateway, Set<String> visited) {
        String field = gateway.path("config").path("evaluatedField").asText("");
        String value = String.valueOf(procedure.getValues().getOrDefault(field, ""));
        String wanted = branchTarget(gateway, value);
        JsonNode rules = rules(policy);
        for (JsonNode connector : rules.path("connectors")) {
            if (!gateway.path("id").asText().equals(connector.path("sourceId").asText())) continue;
            JsonNode target = nodeById(rules, connector.path("targetId").asText());
            if (target != null && (wanted.isBlank() || target.path("label").asText("").toLowerCase().contains(wanted.toLowerCase()))) {
                if ("TASK".equals(target.path("type").asText())) createPendingTask(policy, procedure, target);
                else activateNext(policy, procedure, target.path("id").asText(), visited);
                return;
            }
        }
    }

    private void createPendingTask(Policy policy, ProcedureDocument procedure, JsonNode node) {
        String nodeId = node.path("id").asText();
        if (taskRepository.existsByProcedureIdAndNodeId(procedure.getId(), nodeId)) return;
        taskRepository.save(ProcedureTaskDocument.builder()
                .procedureId(procedure.getId())
                .policyId(policy.getId())
                .nodeId(nodeId)
                .nodeLabel(node.path("label").asText("Tarea"))
                .nodeType(node.path("type").asText("TASK"))
                .taskType(node.path("config").path("taskType").asText("TASK"))
                .departmentId(node.path("departmentId").asText())
                .formTitle(node.path("config").path("form").path("title").asText(node.path("label").asText("Formulario")))
                .formFields(formFields(node))
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build());
    }

    private void closeProcedure(ProcedureDocument procedure, JsonNode end) {
        procedure.setStatus(end.path("config").path("finalStatus").asText("COMPLETED"));
        procedure.setCompletedAt(LocalDateTime.now());
        procedure.setUpdatedAt(LocalDateTime.now());
        procedureRepository.save(procedure);
    }

    private String branchTarget(JsonNode gateway, String value) {
        if (value == null || value.isBlank()) return gateway.path("config").path("defaultBranch").asText("");
        for (String line : gateway.path("config").path("branches").asText("").split("\\n")) {
            if (line.toLowerCase().contains(value.toLowerCase()) && line.contains("→")) return line.substring(line.indexOf("→") + 1).trim();
        }
        return gateway.path("config").path("defaultBranch").asText("");
    }

    private List<Map<String, Object>> formFields(JsonNode node) {
        JsonNode fields = node.path("config").path("form").path("fields");
        if (!fields.isArray()) return List.of();
        return objectMapper.convertValue(fields, objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
    }

    private Map<String, Object> toLearningEvent(ProcedureTaskDocument task) {
        LocalDateTime startedAt = task.getAssignedAt() != null ? task.getAssignedAt() : task.getCreatedAt();
        String departmentId = task.getDepartmentId() == null ? "" : task.getDepartmentId();
        String taskType = task.getTaskType() != null ? task.getTaskType() : task.getNodeType() != null ? task.getNodeType() : "TASK";
        double durationHours = startedAt != null && task.getCompletedAt() != null
                ? Math.max(0.0, Duration.between(startedAt, task.getCompletedAt()).toMinutes() / 60.0)
                : 0.0;
        double waitingSignatureHours = hasSignatureValue(task) && task.getCreatedAt() != null && task.getCompletedAt() != null
                ? Math.max(0.0, Duration.between(task.getCreatedAt(), task.getCompletedAt()).toMinutes() / 60.0 - durationHours)
                : 0.0;
        return Map.of(
                "policyName", task.getPolicyId() == null ? "global" : task.getPolicyId(),
                "policyId", task.getPolicyId() == null ? "" : task.getPolicyId(),
                "taskLabel", task.getNodeLabel() == null ? "Tarea" : task.getNodeLabel(),
                "departmentId", departmentId,
                "taskType", taskType,
                "durationHours", durationHours,
                "queueSize", departmentId.isBlank() ? 0 : taskRepository.countByDepartmentIdAndStatus(departmentId, "PENDING"),
                "reworkCount", 0,
                "waitingSignatureHours", waitingSignatureHours,
                "completed", true
        );
    }

    private boolean hasSignatureValue(ProcedureTaskDocument task) {
        if (task.getFormValues() == null) return false;
        return task.getFormValues().values().stream().anyMatch(value -> String.valueOf(value).toUpperCase().contains("FIRMA"));
    }

    private String startDepartmentId(Policy policy) {
        JsonNode start = firstNode(policy, "START");
        return start == null ? "" : start.path("departmentId").asText("");
    }

    private JsonNode firstNode(Policy policy, String type) {
        for (JsonNode node : rules(policy).path("nodes")) if (type.equals(node.path("type").asText())) return node;
        return null;
    }

    private JsonNode nodeById(JsonNode rules, String id) {
        for (JsonNode node : rules.path("nodes")) if (id.equals(node.path("id").asText())) return node;
        return null;
    }

    private JsonNode rules(Policy policy) {
        try { return objectMapper.readTree(policy.getRules() == null ? "{}" : policy.getRules()); }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.CONFLICT, "La política no tiene reglas válidas."); }
    }

    private ProcedureTaskDocument requireTask(String taskId) {
        return taskRepository.findById(taskId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada."));
    }

    private List<String> userDepartments(String username) {
        User user = userRepository.findByUsername(username).orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Usuario no encontrado."));
        return user.getDepartmentIds() == null ? List.of() : new ArrayList<>(user.getDepartmentIds());
    }
}

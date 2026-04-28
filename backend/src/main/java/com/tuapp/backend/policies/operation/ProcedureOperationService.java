package com.tuapp.backend.policies.operation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tuapp.backend.policies.operation.dto.ProcedureTrackingResponse;
import com.tuapp.backend.policies.application.PolicyService;
import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.Department;
import com.tuapp.backend.users.domain.DepartmentRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.tuapp.backend.users.domain.UserRepository;
import com.tuapp.backend.shared.infrastructure.notifications.PushNotificationService;
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
    private final ProcedureNotificationMongoRepository notificationRepository;
    private final DepartmentRepository departmentRepository;
    private final ObjectMapper objectMapper;
    private final PasswordEncoder passwordEncoder;
    private final PushNotificationService pushNotificationService;

    public ProcedureOperationService(PolicyService policyService, UserRepository userRepository, ProcedureMongoRepository procedureRepository, ProcedureTaskMongoRepository taskRepository, ProcedureNotificationMongoRepository notificationRepository, DepartmentRepository departmentRepository, ObjectMapper objectMapper, PasswordEncoder passwordEncoder, PushNotificationService pushNotificationService) {
        this.policyService = policyService;
        this.userRepository = userRepository;
        this.procedureRepository = procedureRepository;
        this.taskRepository = taskRepository;
        this.notificationRepository = notificationRepository;
        this.departmentRepository = departmentRepository;
        this.objectMapper = objectMapper;
        this.passwordEncoder = passwordEncoder;
        this.pushNotificationService = pushNotificationService;
    }

    public Map<String, Object> currentUserContext(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Usuario no encontrado."));
        List<Map<String, Object>> departments = (user.getDepartmentIds() == null ? List.<String>of() : user.getDepartmentIds()).stream()
                .map(departmentId -> departmentRepository.findById(departmentId)
                        .map(dept -> Map.<String, Object>of(
                                "id", dept.getId(),
                                "name", dept.getName(),
                                "description", dept.getDescription() == null ? "" : dept.getDescription(),
                                "active", dept.isActive()
                        ))
                        .orElse(Map.<String, Object>of("id", departmentId, "name", departmentId, "description", "", "active", true)))
                .toList();

        return Map.of(
                "username", user.getUsername(),
                "name", user.getName() == null ? user.getUsername() : user.getName(),
                "roles", user.getRoles() == null ? List.of() : user.getRoles(),
                "departments", departments
        );
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

        // Manage client
        String clientId = null;
        String clientName = request.getClientFullName();
        String clientCi = request.getClientCi();
        
        if (clientCi != null && !clientCi.trim().isEmpty()) {
            User clientUser = userRepository.findByUsername(clientCi).orElse(null);
            if (clientUser == null) {
                // Check email just in case
                if (request.getClientEmail() != null && !request.getClientEmail().trim().isEmpty()) {
                    clientUser = userRepository.findByEmail(request.getClientEmail()).orElse(null);
                }
            }
            
            if (clientUser == null) {
                // Create new client user
                clientUser = new User();
                clientUser.setUsername(clientCi);
                clientUser.setEmail(request.getClientEmail() != null ? request.getClientEmail() : clientCi + "@cliente.local");
                clientUser.setPassword(passwordEncoder.encode(clientCi));
                clientUser.setRoles(List.of(Role.CLIENT));
                clientUser.setDepartmentIds(List.of());
                clientUser.setName(clientName);
                clientUser.setActive(true);
                clientUser = userRepository.save(clientUser);
            }
            clientId = clientUser.getId();
        }

        LocalDateTime now = LocalDateTime.now();
        ProcedureDocument procedure = procedureRepository.save(ProcedureDocument.builder()
                .policyId(policy.getId())
                .policyName(policy.getName())
                .status("OPEN")
                .createdBy(username)
                .startDepartmentId(startDepartmentId)
                .clientId(clientId)
                .clientName(clientName)
                .clientCi(clientCi)
                .values(request.getValues() == null ? new HashMap<>() : request.getValues())
                .createdAt(now)
                .updatedAt(now)
                .build());
        notifyClientByCi(clientCi,
                "Trámite iniciado: " + policy.getName(),
                "Tu trámite fue registrado y ya está en proceso.",
                Map.of("procedureId", procedure.getId(), "type", "PROCEDURE_CREATED"));
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
        notifySignatureRequests(procedure, saved);
        notifyClientByCi(procedure.getClientCi(),
                "Etapa completada: " + procedure.getPolicyName(),
                "La etapa \"" + task.getNodeLabel() + "\" fue completada.",
                Map.of("procedureId", procedure.getId(), "taskId", task.getId(), "type", "TASK_COMPLETED"));
        if (procedure.getValues() == null) procedure.setValues(new HashMap<>());
        procedure.getValues().putAll(saved.getFormValues());
        procedure.setUpdatedAt(LocalDateTime.now());
        procedureRepository.save(procedure);
        Policy policy = policyService.getPublishedPolicyForExecution(task.getPolicyId());
        activateNext(policy, procedure, task.getNodeId(), new HashSet<>());
        return saved;
    }

    public List<ProcedureTrackingResponse> myProcedures(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Usuario no encontrado."));
        boolean client = user.getRoles() != null && user.getRoles().contains(Role.CLIENT);
        List<ProcedureDocument> procedures = client
                ? procedureRepository.findByClientCiOrderByCreatedAtDesc(username)
                : procedureRepository.findByCreatedByOrderByCreatedAtDesc(username);
        return procedures.stream()
                .map(this::toTrackingResponse)
                .toList();
    }

    public List<ProcedureNotificationDocument> myNotifications(String username) {
        return notificationRepository.findByRecipientUsernameOrderByCreatedAtDesc(username);
    }

    public long unreadNotificationCount(String username) {
        return notificationRepository.countByRecipientUsernameAndReadFalse(username);
    }

    public ProcedureNotificationDocument markNotificationRead(String notificationId, String username) {
        ProcedureNotificationDocument notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notificación no encontrada."));
        if (!username.equals(notification.getRecipientUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No podés leer notificaciones de otro cliente.");
        }
        notification.setRead(true);
        notification.setReadAt(LocalDateTime.now());
        return notificationRepository.save(notification);
    }

    public ProcedureDocument submitClientSignature(String procedureId, ClientSignatureRequest request, String username) {
        ProcedureDocument procedure = procedureRepository.findById(procedureId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trámite no encontrado."));
        if (!username.equals(procedure.getClientCi())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el cliente titular puede firmar este trámite.");
        }
        if (request.getTaskId() == null || request.getTaskId().isBlank() || request.getFieldId() == null || request.getFieldId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La firma debe indicar tarea y campo.");
        }
        if (request.getImageBase64() == null || request.getImageBase64().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La imagen de firma es obligatoria.");
        }

        ProcedureTaskDocument task = taskRepository.findById(request.getTaskId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea de firma no encontrada."));
        if (!procedureId.equals(task.getProcedureId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La tarea no pertenece al trámite indicado.");
        }
        boolean fieldExists = task.getFormFields() != null && task.getFormFields().stream().anyMatch(field ->
                request.getFieldId().equals(String.valueOf(field.get("id")))
                        && "SIGNATURE".equalsIgnoreCase(String.valueOf(field.get("type")))
        );
        if (!fieldExists) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El campo indicado no requiere firma del cliente.");
        }

        if (task.getFormValues() == null) task.setFormValues(new HashMap<>());
        task.getFormValues().put(request.getFieldId(), "FIRMADA POR CLIENTE");
        task.getFormValues().put(request.getFieldId() + "_signedAt", LocalDateTime.now().toString());
        task.getFormValues().put(request.getFieldId() + "_signatureBase64", request.getImageBase64());
        taskRepository.save(task);

        if (procedure.getValues() == null) procedure.setValues(new HashMap<>());
        procedure.getValues().put("clientSignatureTaskId", request.getTaskId());
        procedure.getValues().put("clientSignatureFieldId", request.getFieldId());
        procedure.getValues().put("clientSignatureSignedAt", LocalDateTime.now().toString());
        procedure.setUpdatedAt(LocalDateTime.now());
        return procedureRepository.save(procedure);
    }

    private ProcedureTrackingResponse toTrackingResponse(ProcedureDocument proc) {
        List<ProcedureTaskDocument> tasks = taskRepository.findByProcedureIdOrderByCreatedAtAsc(proc.getId());
        
        long completed = tasks.stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();
        long total = tasks.size();
        
        int progress = 0;
        if ("COMPLETED".equals(proc.getStatus())) {
            progress = 100;
        } else if (total > 0) {
            progress = (int) Math.min(95, (completed * 100) / (total + 1));
        }

        List<String> currentDepts = tasks.stream()
            .filter(t -> !"COMPLETED".equals(t.getStatus()))
            .map(ProcedureTaskDocument::getDepartmentId)
            .distinct()
            .toList();

        List<String> currentTaskNames = tasks.stream()
            .filter(t -> !"COMPLETED".equals(t.getStatus()))
            .map(ProcedureTaskDocument::getNodeLabel)
            .distinct()
            .toList();

        String observation = "";
        if ("COMPLETED".equals(proc.getStatus())) {
            observation = "Trámite finalizado exitosamente.";
            if (!tasks.isEmpty()) {
                ProcedureTaskDocument last = tasks.get(tasks.size() - 1);
                if (last.getFormValues() != null) {
                    observation = last.getFormValues().values().stream()
                        .filter(v -> v != null && String.valueOf(v).length() > 10)
                        .findFirst()
                        .map(Object::toString)
                        .orElse(observation);
                }
            }
        }

        return ProcedureTrackingResponse.builder()
            .id(proc.getId())
            .policyId(proc.getPolicyId())
            .policyName(proc.getPolicyName())
            .clientId(proc.getClientId())
            .clientName(proc.getClientName())
            .clientCi(proc.getClientCi())
            .status(proc.getStatus())
            .createdAt(proc.getCreatedAt())
            .updatedAt(proc.getUpdatedAt())
            .completedAt(proc.getCompletedAt())
            .progressPercentage(progress)
            .currentDepartments(currentDepts)
            .currentTasks(currentTaskNames)
            .finalObservation(observation)
            .pendingSignatureRequests(pendingSignatureRequests(tasks))
            .build();
    }

    private List<Map<String, Object>> pendingSignatureRequests(List<ProcedureTaskDocument> tasks) {
        List<Map<String, Object>> pending = new ArrayList<>();
        for (ProcedureTaskDocument task : tasks) {
            if (task.getFormFields() == null) continue;
            for (Map<String, Object> field : task.getFormFields()) {
                if (!"SIGNATURE".equalsIgnoreCase(String.valueOf(field.get("type")))) continue;
                String fieldId = String.valueOf(field.get("id"));
                Object value = task.getFormValues() == null ? null : task.getFormValues().get(fieldId);
                boolean signed = value != null && String.valueOf(value).toUpperCase().contains("FIRMADA");
                if (signed) continue;
                pending.add(Map.of(
                        "taskId", task.getId(),
                        "fieldId", fieldId,
                        "label", String.valueOf(field.getOrDefault("label", "Firma del cliente")),
                        "message", String.valueOf(field.getOrDefault("signatureMessage", "Se requiere tu firma digital.")),
                        "taskLabel", task.getNodeLabel() == null ? "Etapa del trámite" : task.getNodeLabel()
                ));
            }
        }
        return pending;
    }

    public List<Map<String, Object>> learningEvents() {
        return taskRepository.findByStatusOrderByCompletedAtDesc("COMPLETED").stream()
                .limit(500)
                .map(this::toLearningEvent)
                .toList();
    }

    public Map<String, Object> globalStats() {
        List<ProcedureDocument> all = procedureRepository.findAll();
        long count = all.stream().filter(p -> "COMPLETED".equals(p.getStatus())).count();
        double avgHours = all.stream()
                .filter(p -> "COMPLETED".equals(p.getStatus()) && p.getCreatedAt() != null && p.getCompletedAt() != null)
                .mapToDouble(p -> Duration.between(p.getCreatedAt(), p.getCompletedAt()).toMinutes() / 60.0)
                .average()
                .orElse(0.0);
        return Map.of(
                "completedProcedures", count,
                "avgProcedureHours", avgHours
        );
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
        
        List<Map<String, Object>> fields = formFields(node);
        ProcedureTaskDocument task = taskRepository.save(ProcedureTaskDocument.builder()
                .procedureId(procedure.getId())
                .policyId(policy.getId())
                .nodeId(nodeId)
                .nodeLabel(node.path("label").asText("Tarea"))
                .nodeType(node.path("type").asText("TASK"))
                .taskType(node.path("config").path("taskType").asText("TASK"))
                .departmentId(node.path("departmentId").asText())
                .formTitle(node.path("config").path("form").path("title").asText(node.path("label").asText("Formulario")))
                .formFields(fields)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build());

        notifyClientIfApplicable(procedure, task, node, fields);
    }

    private void notifyClientIfApplicable(ProcedureDocument procedure, ProcedureTaskDocument task, JsonNode node, List<Map<String, Object>> fields) {
        JsonNode config = node.path("config");
        boolean notifyByTask = config.path("notifyClient").asBoolean(false) || config.path("visibleToClient").asBoolean(false);

        if (notifyByTask) {
            notifyClientByCi(procedure.getClientCi(),
                    "Avance de trámite: " + procedure.getPolicyName(),
                    "Tu trámite avanzó a: " + task.getNodeLabel(),
                    Map.of("procedureId", procedure.getId(), "taskId", task.getId(), "type", "STATUS_UPDATE"));
        }

        for (Map<String, Object> field : fields) {
            boolean requireSignature = "SIGNATURE".equalsIgnoreCase(String.valueOf(field.get("type")));
            boolean notifyClient = Boolean.TRUE.equals(field.get("notifyClient")) || Boolean.TRUE.equals(field.get("visibleToClient"));

            if (requireSignature) {
                String customMessage = String.valueOf(field.getOrDefault("signatureMessage", "")).trim();
                notifyClientByCi(procedure.getClientCi(),
                        "Firma requerida",
                        customMessage.isBlank() ? "Se requiere tu firma digital para: " + String.valueOf(field.get("label")) : customMessage,
                        Map.of("procedureId", procedure.getId(), "taskId", task.getId(), "fieldId", String.valueOf(field.get("id")), "type", "SIGNATURE_REQUIRED"));
            } else if (notifyClient) {
                notifyClientByCi(procedure.getClientCi(),
                        "Actualización del trámite",
                        "Revisá el avance relacionado con: " + String.valueOf(field.get("label")),
                        Map.of("procedureId", procedure.getId(), "taskId", task.getId(), "fieldId", String.valueOf(field.get("id")), "type", "FIELD_NOTIFICATION"));
            }
        }
    }

    private void closeProcedure(ProcedureDocument procedure, JsonNode end) {
        procedure.setStatus(end.path("config").path("finalStatus").asText("COMPLETED"));
        procedure.setCompletedAt(LocalDateTime.now());
        procedure.setUpdatedAt(LocalDateTime.now());
        procedureRepository.save(procedure);
        notifyClientByCi(procedure.getClientCi(),
                "Trámite finalizado: " + procedure.getPolicyName(),
                end.path("config").path("customerMessage").asText("Tu trámite finalizó. Revisá el resultado en la app."),
                Map.of("procedureId", procedure.getId(), "type", "PROCEDURE_CLOSED"));
    }

    private void notifySignatureRequests(ProcedureDocument procedure, ProcedureTaskDocument task) {
        if (task.getFormValues() == null || task.getFormFields() == null) return;
        for (Map<String, Object> field : task.getFormFields()) {
            if (!"SIGNATURE".equalsIgnoreCase(String.valueOf(field.get("type")))) continue;
            Object value = task.getFormValues().get(String.valueOf(field.get("id")));
            if (value == null || !String.valueOf(value).toUpperCase().contains("SOLICITADA")) continue;
            String customMessage = String.valueOf(field.getOrDefault("signatureMessage", "")).trim();
            notifyClientByCi(procedure.getClientCi(),
                    "Firma pendiente",
                    customMessage.isBlank() ? "Tenés una firma pendiente para: " + String.valueOf(field.get("label")) : customMessage,
                    Map.of("procedureId", procedure.getId(), "taskId", task.getId(), "fieldId", String.valueOf(field.get("id")), "type", "SIGNATURE_REQUESTED"));
        }
    }

    private void notifyClientByCi(String clientCi, String title, String body, Map<String, String> data) {
        if (clientCi == null || clientCi.isBlank()) return;
        userRepository.findByUsername(clientCi).ifPresent(client -> {
            notificationRepository.save(ProcedureNotificationDocument.builder()
                    .recipientUsername(client.getUsername())
                    .title(title)
                    .body(body)
                    .type(data.getOrDefault("type", "PROCEDURE_UPDATE"))
                    .procedureId(data.get("procedureId"))
                    .taskId(data.get("taskId"))
                    .fieldId(data.get("fieldId"))
                    .data(data)
                    .read(false)
                    .createdAt(LocalDateTime.now())
                    .build());
            String fcmToken = client.getFcmToken();
            if (fcmToken == null || fcmToken.isBlank()) return;
            pushNotificationService.sendPushNotificationToToken(fcmToken, title, body, data);
        });
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

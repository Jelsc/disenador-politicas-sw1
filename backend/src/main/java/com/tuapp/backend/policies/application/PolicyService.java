package com.tuapp.backend.policies.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tuapp.backend.policies.collaboration.PolicyNotificationWebSocketHandler;
import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.policies.domain.PolicyInvitation;
import com.tuapp.backend.policies.domain.PolicyRepository;
import com.tuapp.backend.policies.infrastructure.PolicyAutosaveDocument;
import com.tuapp.backend.policies.infrastructure.PolicyAutosaveMongoRepository;
import com.tuapp.backend.policies.infrastructure.PolicyChangeLogDocument;
import com.tuapp.backend.policies.infrastructure.PolicyChangeLogMongoRepository;
import com.tuapp.backend.policies.infrastructure.PolicyVersionDocument;
import com.tuapp.backend.policies.infrastructure.PolicyVersionMongoRepository;
import com.tuapp.backend.policies.presentation.dto.PolicyAutosaveRequest;
import com.tuapp.backend.policies.presentation.dto.PolicyChangeLogRequest;
import com.tuapp.backend.policies.presentation.dto.PolicyRequest;
import com.tuapp.backend.policies.presentation.dto.PolicyVersionRequest;
import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
public class PolicyService {

    private final PolicyRepository repository;
    private final PolicyVersionMongoRepository versionRepository;
    private final PolicyAutosaveMongoRepository autosaveRepository;
    private final PolicyChangeLogMongoRepository changeLogRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final PolicyNotificationWebSocketHandler notificationWebSocketHandler;

    public PolicyService(PolicyRepository repository,
                         PolicyVersionMongoRepository versionRepository,
                         PolicyAutosaveMongoRepository autosaveRepository,
                         PolicyChangeLogMongoRepository changeLogRepository,
                         UserRepository userRepository,
                         ObjectMapper objectMapper,
                         PolicyNotificationWebSocketHandler notificationWebSocketHandler) {
        this.repository = repository;
        this.versionRepository = versionRepository;
        this.autosaveRepository = autosaveRepository;
        this.changeLogRepository = changeLogRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.notificationWebSocketHandler = notificationWebSocketHandler;
    }

    public List<Policy> getAllPolicies(String username, boolean admin) {
        return repository.findAll().stream()
                .filter(policy -> canList(policy, username, admin))
                .toList();
    }

    public List<Policy> getPublishedPoliciesForExecution() {
        return repository.findAll().stream()
                .filter(policy -> isPublished(policy.getStatus()))
                .toList();
    }

    public Policy getPublishedPolicyForExecution(String id) {
        Policy policy = requirePolicy(id);
        if (!isPublished(policy.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Published policy not found");
        }
        return policy;
    }

    public Policy getPolicyById(String id, String username, boolean admin) {
        Policy policy = requirePolicy(id);
        if (!canView(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this policy");
        }
        return policy;
    }

    public Policy createPolicy(PolicyRequest request, String username) {
        Policy policy = Policy.builder()
                .name(request.getName())
                .description(defaultText(request.getDescription(), "Sin descripción"))
                .version(request.getVersion() != null ? request.getVersion() : "1.0.0")
                .rules(request.getRules())
                .createdBy(username)
                .editors(new ArrayList<>())
                .invitations(new ArrayList<>())
                .currentPublishedVersionId(null)
                .status(normalizeStatus(request.getStatus()))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        return repository.save(policy);
    }

    public Policy updatePolicy(String id, PolicyRequest request, String username, boolean admin) {
        Policy existing = getPolicyById(id, username, admin);
        if (!canEdit(existing, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }
        if (isPublished(existing.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Published policies cannot be edited directly. Create a new editable draft from a version.");
        }

        existing.setName(request.getName());
        existing.setDescription(defaultText(request.getDescription(), "Sin descripción"));
        if (request.getVersion() != null) existing.setVersion(request.getVersion());
        if (request.getRules() != null) existing.setRules(request.getRules());
        if (request.getStatus() != null) existing.setStatus(normalizeStatus(request.getStatus()));
        existing.setUpdatedAt(LocalDateTime.now());
        return repository.save(existing);
    }

    public List<PolicyVersionDocument> getPolicyVersions(String policyId, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canView(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this policy");
        }
        return versionRepository.findByPolicyIdOrderByRevisionDesc(policyId);
    }

    public PolicyVersionDocument createNamedVersion(String policyId, PolicyVersionRequest request, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canEdit(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }

        int versionNumber = (int) versionRepository.countByPolicyId(policyId) + 1;
        String nextSemanticVersion = incrementPatchVersion(policy.getVersion());
        policy.setVersion(nextSemanticVersion);
        policy.setUpdatedAt(LocalDateTime.now());
        repository.save(policy);

        PolicyVersionDocument saved = versionRepository.save(PolicyVersionDocument.builder()
                .policyId(policyId)
                .revision(versionNumber)
                .versionNumber(versionNumber)
                .name(defaultText(request.getName(), "Versión " + versionNumber))
                .description(policy.getDescription())
                .version(nextSemanticVersion)
                .rules(policy.getRules())
                .diagramSnapshotJson(policy.getRules())
                .status(normalizeStatus(policy.getStatus()))
                .createdBy(username)
                .createdAt(LocalDateTime.now())
                .published(false)
                .changelogSummary(defaultText(request.getChangelogSummary(), "Sin resumen"))
                .build());

        saveChangeLog(policyId, saved.getId(), username, "CREATE_NAMED_VERSION", "POLICY_VERSION", saved.getId(), null, saved.getName());
        return saved;
    }

    public Policy publishVersion(String policyId, String versionId, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canEdit(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }

        PolicyVersionDocument version = requireVersion(policyId, versionId);
        validatePublishable(version.getDiagramSnapshotJson());

        version.setPublished(true);
        version.setPublishedAt(LocalDateTime.now());
        version.setStatus("PUBLICADA");
        versionRepository.save(version);

        policy.setDescription(version.getDescription());
        policy.setVersion(version.getVersion());
        policy.setRules(version.getDiagramSnapshotJson());
        policy.setCurrentPublishedVersionId(version.getId());
        policy.setStatus("PUBLICADA");
        policy.setUpdatedAt(LocalDateTime.now());
        Policy saved = repository.save(policy);

        saveChangeLog(policyId, versionId, username, "PUBLISH_VERSION", "POLICY_VERSION", versionId, null, version.getName());
        return saved;
    }

    public Policy restorePolicyVersion(String policyId, String versionId, String username, boolean admin) {
        Policy existing = getPolicyById(policyId, username, admin);
        if (!canEdit(existing, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }

        PolicyVersionDocument version = requireVersion(policyId, versionId);
        String previousRules = existing.getRules();
        existing.setDescription(version.getDescription());
        existing.setVersion(version.getVersion());
        existing.setRules(version.getDiagramSnapshotJson());
        existing.setStatus("BORRADOR");
        existing.setUpdatedAt(LocalDateTime.now());
        Policy saved = repository.save(existing);

        saveChangeLog(policyId, versionId, username, "RESTORE_VERSION", "POLICY_VERSION", versionId, previousRules, version.getDiagramSnapshotJson());
        return saved;
    }

    public Policy duplicateVersionAsDraft(String policyId, String versionId, String username, boolean admin) {
        Policy existing = getPolicyById(policyId, username, admin);
        if (!canEdit(existing, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }

        PolicyVersionDocument version = requireVersion(policyId, versionId);
        Policy saved = repository.save(Policy.builder()
                .name(existing.getName() + " (borrador)")
                .description(version.getDescription())
                .version(version.getVersion())
                .rules(version.getDiagramSnapshotJson())
                .createdBy(username)
                .editors(new ArrayList<>())
                .invitations(new ArrayList<>())
                .currentPublishedVersionId(null)
                .status("BORRADOR")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build());

        saveChangeLog(saved.getId(), versionId, username, "DUPLICATE_VERSION_TO_DRAFT", "POLICY_VERSION", versionId, null, version.getName());
        return saved;
    }

    public void deleteVersion(String policyId, String versionId, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canEdit(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }
        PolicyVersionDocument version = requireVersion(policyId, versionId);
        if (version.isPublished()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Published versions cannot be deleted");
        }
        versionRepository.deleteById(versionId);
        saveChangeLog(policyId, versionId, username, "DELETE_VERSION", "POLICY_VERSION", versionId, version.getName(), null);
    }

    public Policy clonePolicy(String policyId, String username, boolean admin) {
        Policy source = getPolicyById(policyId, username, admin);
        Policy clone = Policy.builder()
                .name(source.getName() + " (copia)")
                .description(source.getDescription())
                .version(source.getVersion())
                .rules(source.getRules())
                .createdBy(username)
                .editors(new ArrayList<>())
                .invitations(new ArrayList<>())
                .currentPublishedVersionId(null)
                .status("BORRADOR")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        Policy saved = repository.save(clone);
        saveChangeLog(saved.getId(), null, username, "CLONE_POLICY", "POLICY", source.getId(), null, source.getName());
        return saved;
    }

    public Policy archivePolicy(String policyId, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canArchive(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have archive access to this policy");
        }
        if (!isPublished(policy.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only published policies can be archived");
        }
        policy.setStatus("ARCHIVADA");
        policy.setUpdatedAt(LocalDateTime.now());
        Policy saved = repository.save(policy);
        saveChangeLog(policyId, null, username, "ARCHIVE_POLICY", "POLICY", policyId, null, "ARCHIVADA");
        return saved;
    }

    public void deletePolicy(String id, String username, boolean admin) {
        Policy policy = getPolicyById(id, username, admin);
        if (!canDelete(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have delete access to this policy");
        }
        repository.deleteById(id);
    }

    public List<PolicyEditorCandidateResponse> getEligibleEditors(String username, boolean admin) {
        if (!admin && username == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to invite editors");
        }

        List<PolicyEditorCandidateResponse> candidates = new ArrayList<>();
        userRepository.findAll().forEach(user -> {
            if (!user.isActive()) return;
            String role = primaryRole(user);
            if (!"ADMIN".equals(role) && !"DESIGNER".equals(role)) return;
            if (username != null && username.equals(user.getUsername())) return;
            candidates.add(new PolicyEditorCandidateResponse(user.getId(), user.getUsername(), role));
        });
        return candidates;
    }

    public Policy updatePolicyEditors(String id, List<String> requestedUsernames, String username, boolean admin) {
        Policy policy = requirePolicy(id);
        if (!canManageEditors(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to manage invitations for this policy");
        }

        List<String> desired = normalizeEditors(requestedUsernames, policy.getCreatedBy());
        List<String> acceptedEditors = policy.getEditors() != null ? new ArrayList<>(policy.getEditors()) : new ArrayList<>();
        List<PolicyInvitation> invitations = policy.getInvitations() != null ? new ArrayList<>(policy.getInvitations()) : new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        acceptedEditors.removeIf(editor -> !desired.contains(editor));
        invitations.removeIf(invitation -> !desired.contains(invitation.getUsername()));

        for (String candidate : desired) {
            Optional<PolicyInvitation> existingInvitation = invitations.stream()
                    .filter(invitation -> Objects.equals(invitation.getUsername(), candidate))
                    .findFirst();

            if (acceptedEditors.contains(candidate)) {
                if (existingInvitation.isEmpty()) {
                    invitations.add(PolicyInvitation.builder()
                            .username(candidate)
                            .invitedBy(username)
                            .status("ACCEPTED")
                            .invitedAt(now)
                            .respondedAt(now)
                            .build());
                }
                continue;
            }

            if (existingInvitation.isPresent()) {
                PolicyInvitation invitation = existingInvitation.get();
                if (!"ACCEPTED".equals(invitation.getStatus())) {
                    invitation.setInvitedBy(username);
                    invitation.setInvitedAt(now);
                    invitation.setRespondedAt(null);
                    invitation.setStatus("PENDING");
                }
                continue;
            }

            invitations.add(PolicyInvitation.builder()
                    .username(candidate)
                    .invitedBy(username)
                    .status("PENDING")
                    .invitedAt(now)
                    .build());
            pushInvitationNotification(candidate, policy.getId(), policy.getName(), username);
        }

        policy.setEditors(acceptedEditors);
        policy.setInvitations(invitations);
        policy.setUpdatedAt(now);
        Policy saved = repository.save(policy);
        saveChangeLog(id, null, username, "UPDATE_INVITATIONS", "POLICY", id, null, String.join(",", desired));
        return saved;
    }

    public List<PolicyInvitationNotificationResponse> getPendingInvitations(String username) {
        List<PolicyInvitationNotificationResponse> notifications = new ArrayList<>();
        repository.findAll().forEach(policy -> {
            if (policy.getInvitations() == null) return;
            policy.getInvitations().stream()
                    .filter(invitation -> Objects.equals(invitation.getUsername(), username))
                    .filter(invitation -> "PENDING".equals(invitation.getStatus()))
                    .findFirst()
                    .ifPresent(invitation -> notifications.add(
                            new PolicyInvitationNotificationResponse(policy.getId(), policy.getName(), invitation.getInvitedBy(), invitation.getInvitedAt())
                    ));
        });
        return notifications;
    }

    public Policy respondToInvitation(String policyId, String username, String decision) {
        Policy policy = requirePolicy(policyId);
        List<PolicyInvitation> invitations = policy.getInvitations() != null ? new ArrayList<>(policy.getInvitations()) : new ArrayList<>();
        PolicyInvitation invitation = invitations.stream()
                .filter(item -> Objects.equals(item.getUsername(), username))
                .filter(item -> "PENDING".equals(item.getStatus()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pending invitation not found"));

        String normalizedDecision = decision == null ? "" : decision.trim().toUpperCase();
        if (!"ACCEPT".equals(normalizedDecision) && !"REJECT".equals(normalizedDecision)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decision must be ACCEPT or REJECT");
        }

        invitation.setRespondedAt(LocalDateTime.now());
        if ("ACCEPT".equals(normalizedDecision)) {
            invitation.setStatus("ACCEPTED");
            List<String> editors = policy.getEditors() != null ? new ArrayList<>(policy.getEditors()) : new ArrayList<>();
            if (!editors.contains(username)) editors.add(username);
            policy.setEditors(editors);
        } else {
            invitation.setStatus("REJECTED");
        }

        policy.setInvitations(invitations);
        policy.setUpdatedAt(LocalDateTime.now());
        Policy saved = repository.save(policy);
        saveChangeLog(policyId, null, username, "RESPOND_INVITATION", "POLICY_INVITATION", username, null, invitation.getStatus());
        return saved;
    }

    public PolicyAutosaveDocument saveAutosave(String policyId, PolicyAutosaveRequest request, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canEdit(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }

        PolicyAutosaveDocument autosave = autosaveRepository
                .findByPolicyIdAndUsernameAndSessionId(policyId, username, defaultText(request.getSessionId(), "default-session"))
                .orElseGet(PolicyAutosaveDocument::new);

        autosave.setPolicyId(policyId);
        autosave.setUsername(username);
        autosave.setSessionId(defaultText(request.getSessionId(), "default-session"));
        autosave.setName(defaultText(request.getName(), policy.getName()));
        autosave.setDescription(defaultText(request.getDescription(), policy.getDescription()));
        autosave.setDiagramDraftJson(request.getDiagramDraftJson());
        autosave.setSavedAt(LocalDateTime.now());
        return autosaveRepository.save(autosave);
    }

    public PolicyAutosaveDocument getLatestAutosave(String policyId, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canEdit(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }
        return autosaveRepository.findTopByPolicyIdAndUsernameOrderBySavedAtDesc(policyId, username)
                .orElse(null);
    }

    public List<PolicyChangeLogDocument> getChangeLogs(String policyId, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canView(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this policy");
        }
        return changeLogRepository.findTop100ByPolicyIdOrderByCreatedAtDesc(policyId);
    }

    public PolicyChangeLogDocument recordChange(String policyId, PolicyChangeLogRequest request, String username, boolean admin) {
        Policy policy = getPolicyById(policyId, username, admin);
        if (!canEdit(policy, username, admin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have edit access to this policy");
        }
        return saveChangeLog(policyId, request.getPolicyVersionId(), username, request.getActionType(), request.getTargetType(), request.getTargetId(), request.getBeforeValue(), request.getAfterValue());
    }

    private PolicyChangeLogDocument saveChangeLog(String policyId,
                                                  String policyVersionId,
                                                  String username,
                                                  String actionType,
                                                  String targetType,
                                                  String targetId,
                                                  String beforeValue,
                                                  String afterValue) {
        return changeLogRepository.save(PolicyChangeLogDocument.builder()
                .policyId(policyId)
                .policyVersionId(policyVersionId)
                .username(username)
                .actionType(actionType)
                .targetType(targetType)
                .targetId(targetId)
                .beforeValue(beforeValue)
                .afterValue(afterValue)
                .createdAt(LocalDateTime.now())
                .build());
    }

    private void validatePublishable(String rulesJson) {
        try {
            JsonNode root = objectMapper.readTree(rulesJson == null ? "{}" : rulesJson);
            JsonNode nodes = root.path("nodes");
            JsonNode connectors = root.path("connectors");

            int startCount = 0;
            int endCount = 0;
            Set<String> nodeIds = new HashSet<>();
            Map<String, JsonNode> nodeById = new HashMap<>();
            Map<String, Integer> incoming = new HashMap<>();
            Map<String, Integer> outgoing = new HashMap<>();
            Set<String> decisionFieldIds = new HashSet<>();

            if (nodes.isArray()) {
                for (JsonNode node : nodes) {
                    String id = node.path("id").asText();
                    String type = node.path("type").asText();
                    if (!id.isBlank()) {
                        nodeIds.add(id);
                        nodeById.put(id, node);
                        incoming.put(id, 0);
                        outgoing.put(id, 0);
                    }
                    if ("START".equalsIgnoreCase(type)) startCount++;
                    if ("END".equalsIgnoreCase(type)) endCount++;
                }
            }

            if (startCount != 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A policy must have exactly one Start node to publish");
            }
            if (endCount < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A policy must have at least one End node to publish");
            }
            if (!connectors.isArray() || connectors.size() == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A policy must have valid connections before publishing");
            }

            for (JsonNode connector : connectors) {
                String sourceId = connector.path("sourceId").asText();
                String targetId = connector.path("targetId").asText();
                if (!nodeIds.contains(sourceId) || !nodeIds.contains(targetId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A policy contains invalid connections");
                }
                outgoing.computeIfPresent(sourceId, (key, value) -> value + 1);
                incoming.computeIfPresent(targetId, (key, value) -> value + 1);
            }

            for (JsonNode node : nodeById.values()) {
                if (!"TASK".equalsIgnoreCase(node.path("type").asText())) continue;
                JsonNode fields = node.path("config").path("form").path("fields");
                if (!fields.isArray()) continue;
                for (JsonNode field : fields) {
                    if (field.path("usedForDecision").asBoolean(false) && !field.path("id").asText().isBlank()) {
                        decisionFieldIds.add(field.path("id").asText());
                    }
                }
            }

            for (JsonNode node : nodeById.values()) {
                String id = node.path("id").asText();
                String label = node.path("label").asText(node.path("type").asText());
                String type = node.path("type").asText();
                JsonNode config = node.path("config");
                int incomingCount = incoming.getOrDefault(id, 0);
                int outgoingCount = outgoing.getOrDefault(id, 0);

                if ("START".equalsIgnoreCase(type) && (incomingCount > 0 || outgoingCount < 1)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start node must not have incoming connections and must have at least one outgoing connection");
                }
                if ("END".equalsIgnoreCase(type) && outgoingCount > 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End node '" + label + "' cannot have outgoing connections");
                }
                if ("TASK".equalsIgnoreCase(type)) {
                    if (node.path("departmentId").asText().isBlank()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task '" + label + "' must have a department");
                    }
                    if (config.path("taskType").asText().isBlank() || config.path("estimatedTime").asText().isBlank()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task '" + label + "' must define task type and estimated time");
                    }
                    JsonNode fields = config.path("form").path("fields");
                    if (!fields.isArray() || fields.size() == 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task '" + label + "' must have at least one form field");
                    }
                    boolean hasSignatureField = false;
                    for (JsonNode field : fields) {
                        String fieldType = field.path("type").asText();
                        if (field.path("label").asText().isBlank()) {
                            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task '" + label + "' has form fields without label");
                        }
                        if (("SINGLE_CHOICE".equalsIgnoreCase(fieldType) || "MULTIPLE_CHOICE".equalsIgnoreCase(fieldType) || "RESULT".equalsIgnoreCase(fieldType))
                                && (!field.path("options").isArray() || field.path("options").size() == 0)) {
                            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task '" + label + "' has choice/result fields without options");
                        }
                        if ("SIGNATURE".equalsIgnoreCase(fieldType)) hasSignatureField = true;
                    }
                    if (config.path("requiresSignature").asBoolean(false) && !hasSignatureField) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task '" + label + "' requires a client signature field");
                    }
                }
                if ("GATEWAY".equalsIgnoreCase(type)) {
                    if (outgoingCount < 2 || config.path("evaluatedField").asText().isBlank() || config.path("branches").asText().isBlank() || config.path("defaultBranch").asText().isBlank()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decision '" + label + "' must define evaluated field, branches, default path, and at least two outputs");
                    }
                    if (!decisionFieldIds.contains(config.path("evaluatedField").asText())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decision '" + label + "' references a task field that is not marked for decision use");
                    }
                }
                if ("PARALLEL".equalsIgnoreCase(type) && (incomingCount < 1 || outgoingCount < 2)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parallel node '" + label + "' must have one input and at least two outputs");
                }
                if ("JOIN".equalsIgnoreCase(type) && (incomingCount < 2 || outgoingCount < 1)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Join node '" + label + "' must have at least two inputs and one output");
                }
            }
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Policy diagram is invalid and cannot be published");
        }
    }

    private Policy requirePolicy(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Policy not found"));
    }

    private PolicyVersionDocument requireVersion(String policyId, String versionId) {
        PolicyVersionDocument version = versionRepository.findById(versionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Version not found"));
        if (!Objects.equals(policyId, version.getPolicyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Version does not belong to policy");
        }
        return version;
    }

    private boolean canList(Policy policy, String username, boolean admin) {
        return !isDraftLike(policy.getStatus()) || canEdit(policy, username, admin);
    }

    private boolean canView(Policy policy, String username, boolean admin) {
        return canList(policy, username, admin);
    }

    private boolean canEdit(Policy policy, String username, boolean admin) {
        if (policy.getCreatedBy() == null) return admin;
        return admin || Objects.equals(username, policy.getCreatedBy()) || (policy.getEditors() != null && policy.getEditors().contains(username));
    }

    private boolean canDelete(Policy policy, String username, boolean admin) {
        return canEdit(policy, username, admin);
    }

    private boolean canArchive(Policy policy, String username, boolean admin) {
        return canEdit(policy, username, admin);
    }

    private boolean canManageEditors(Policy policy, String username, boolean admin) {
        return canDelete(policy, username, admin);
    }

    private List<String> normalizeEditors(List<String> requestedEditors, String ownerUsername) {
        List<String> editors = new ArrayList<>();
        if (requestedEditors == null) return editors;

        for (String editorUsername : requestedEditors) {
            if (editorUsername == null || editorUsername.isBlank()) continue;
            String normalized = editorUsername.trim();
            if (normalized.equals(ownerUsername) || editors.contains(normalized)) continue;

            User user = userRepository.findByUsername(normalized)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "User " + normalized + " does not exist"));

            if (!user.isActive()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User " + normalized + " is inactive");
            }

            String role = primaryRole(user);
            if (!"ADMIN".equals(role) && !"DESIGNER".equals(role)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User " + normalized + " cannot be invited to edit policies");
            }

            editors.add(normalized);
        }
        return editors;
    }

    private String primaryRole(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) return null;
        Role role = user.getRoles().get(0);
        return role != null ? role.name() : null;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return "BORRADOR";
        return switch (status.trim().toUpperCase()) {
            case "DRAFT", "BORRADOR" -> "BORRADOR";
            case "ACTIVE", "PUBLICADA" -> "PUBLICADA";
            case "ARCHIVED", "ARCHIVADA" -> "ARCHIVADA";
            case "EN_REVISION" -> "EN_REVISION";
            default -> status.trim().toUpperCase();
        };
    }

    private String incrementPatchVersion(String currentVersion) {
        String normalized = currentVersion == null || currentVersion.isBlank()
                ? "1.0.0"
                : currentVersion.trim().replaceFirst("^[vV]", "");
        String[] parts = normalized.split("\\.");
        int major = parseVersionPart(parts, 0, 1);
        int minor = parseVersionPart(parts, 1, 0);
        int patch = parseVersionPart(parts, 2, 0) + 1;
        return major + "." + minor + "." + patch;
    }

    private int parseVersionPart(String[] parts, int index, int fallback) {
        if (index >= parts.length) return fallback;
        try {
            return Integer.parseInt(parts[index].replaceAll("[^0-9]", ""));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private boolean isDraftLike(String status) {
        String normalized = normalizeStatus(status);
        return "BORRADOR".equals(normalized) || "EN_REVISION".equals(normalized);
    }

    private boolean isPublished(String status) {
        return "PUBLICADA".equals(normalizeStatus(status));
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private void pushInvitationNotification(String invitedUsername, String policyId, String policyName, String invitedBy) {
        String payload = String.format(
                "{\"type\":\"POLICY_INVITATION\",\"policyId\":\"%s\",\"policyName\":\"%s\",\"invitedBy\":\"%s\",\"username\":\"%s\",\"timestamp\":%d}",
                escapeJson(policyId),
                escapeJson(policyName),
                escapeJson(invitedBy),
                escapeJson(invitedUsername),
                System.currentTimeMillis()
        );
        notificationWebSocketHandler.notifyUser(invitedUsername, payload);
    }

    private String escapeJson(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}

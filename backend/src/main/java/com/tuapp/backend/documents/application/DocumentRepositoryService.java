package com.tuapp.backend.documents.application;

import com.tuapp.backend.documents.domain.DocumentRepositorySettingsDocument;
import com.tuapp.backend.documents.domain.DocumentVersionDocument;
import com.tuapp.backend.documents.collaboration.DocumentPresenceRegistry;
import com.tuapp.backend.documents.infrastructure.DocumentRepositorySettingsMongoRepository;
import com.tuapp.backend.documents.infrastructure.DocumentVersionMongoRepository;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositoryInviteRequest;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositoryUserResponse;
import com.tuapp.backend.documents.presentation.dto.DocumentVersionResponse;
import com.tuapp.backend.documents.presentation.dto.OnlyOfficeCallbackRequest;
import com.tuapp.backend.documents.presentation.dto.OnlyOfficeEditorConfigResponse;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositorySettingsRequest;
import com.tuapp.backend.shared.infrastructure.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import com.tuapp.backend.policies.operation.ProcedureMongoRepository;
import com.tuapp.backend.policies.operation.ProcedureTaskDocument;
import com.tuapp.backend.policies.operation.ProcedureTaskMongoRepository;
import com.tuapp.backend.policies.operation.ProcedureDocument;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.Base64;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Service
public class DocumentRepositoryService {

    private static final Set<String> ONLYOFFICE_EDITABLE_EXTENSIONS = Set.of("docx", "xlsx", "csv", "pptx");

    private final FileStorageService fileStorageService;
    private final DocumentRepositorySettingsMongoRepository settingsRepository;
    private final DocumentVersionMongoRepository versionRepository;
    private final UserRepository userRepository;
    private final DocumentPresenceRegistry presenceRegistry;
    private final ProcedureMongoRepository procedureRepository;
    private final ProcedureTaskMongoRepository taskRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.onlyoffice.enabled:false}")
    private boolean onlyOfficeEnabled;

    @Value("${app.onlyoffice.document-server-url:}")
    private String onlyOfficeDocumentServerUrl;

    @Value("${app.onlyoffice.internal-document-server-url:}")
    private String onlyOfficeInternalDocumentServerUrl;

    @Value("${app.onlyoffice.shared-secret:}")
    private String onlyOfficeSharedSecret;

    @Value("${app.onlyoffice.backend-base-url:}")
    private String onlyOfficeBackendBaseUrl;

    @Value("${app.onlyoffice.token-ttl-minutes:30}")
    private long onlyOfficeTokenTtlMinutes;

    @Value("${app.frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    public DocumentRepositoryService(FileStorageService fileStorageService,
                                     DocumentRepositorySettingsMongoRepository settingsRepository,
                                     DocumentVersionMongoRepository versionRepository,
                                     UserRepository userRepository,
                                     DocumentPresenceRegistry presenceRegistry,
                                     ProcedureMongoRepository procedureRepository,
                                     ProcedureTaskMongoRepository taskRepository) {
        this.fileStorageService = fileStorageService;
        this.settingsRepository = settingsRepository;
        this.versionRepository = versionRepository;
        this.userRepository = userRepository;
        this.presenceRegistry = presenceRegistry;
        this.procedureRepository = procedureRepository;
        this.taskRepository = taskRepository;
    }

    public DocumentRepositorySettingsDocument upsertSettings(String procedureId, DocumentRepositorySettingsRequest request, String username, boolean admin) {
        DocumentRepositorySettingsDocument current = settingsRepository.findById(procedureId)
                .orElse(DocumentRepositorySettingsDocument.builder().procedureId(procedureId).createdAt(LocalDateTime.now()).build());
        current.setPolicyId(request.policyId());
        current.setAllowedRoles(normalizeList(request.allowedRoles()));
        current.setAllowedFormats(normalizeList(request.allowedFormats()));
        current.setMaxFileSizeMb(request.maxFileSizeMb());
        current.setUpdatedAt(LocalDateTime.now());
        if (current.getCreatedAt() == null) current.setCreatedAt(LocalDateTime.now());
        return settingsRepository.save(current);
    }

    public DocumentRepositorySettingsDocument getSettings(String procedureId) {
        return settingsRepository.findById(procedureId)
                .or(() -> procedureRepository.findById(procedureId)
                        .flatMap(procedure -> settingsRepository.findById(procedure.getPolicyId())
                                .map(policySettings -> {
                                    DocumentRepositorySettingsDocument inheritedSettings = DocumentRepositorySettingsDocument.builder()
                                            .procedureId(procedureId)
                                            .policyId(procedure.getPolicyId())
                                            .allowedRoles(policySettings.getAllowedRoles())
                                            .allowedFormats(policySettings.getAllowedFormats())
                                            .maxFileSizeMb(policySettings.getMaxFileSizeMb())
                                            .createdAt(LocalDateTime.now())
                                            .updatedAt(LocalDateTime.now())
                                            .build();
                                    return settingsRepository.save(inheritedSettings);
                                })))
                .orElseGet(() -> DocumentRepositorySettingsDocument.builder()
                        .procedureId(procedureId)
                        .allowedRoles(List.of())
                        .allowedFormats(List.of())
                        .maxFileSizeMb(10L)
                        .createdAt(LocalDateTime.now())
                        .build());
    }

    public void inheritSettingsFromPolicy(String procedureId, String policyId) {
        settingsRepository.findById(policyId).ifPresent(policySettings -> {
            DocumentRepositorySettingsDocument procedureSettings = DocumentRepositorySettingsDocument.builder()
                    .procedureId(procedureId)
                    .policyId(policyId)
                    .allowedRoles(policySettings.getAllowedRoles())
                    .allowedFormats(policySettings.getAllowedFormats())
                    .maxFileSizeMb(policySettings.getMaxFileSizeMb())
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            settingsRepository.save(procedureSettings);
        });
    }

    public List<DocumentVersionDocument> listLatestDocuments(String procedureId, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanRead(procedureId, settings, role, username, admin);
        List<DocumentVersionDocument> all = versionRepository.findByProcedureIdOrderByCreatedAtDesc(procedureId);
        Map<String, DocumentVersionDocument> latestByDocument = new LinkedHashMap<>();
        for (DocumentVersionDocument version : all) {
            latestByDocument.putIfAbsent(version.getDocumentId(), version);
        }
        return List.copyOf(latestByDocument.values());
    }

    public List<DocumentVersionDocument> listVersions(String procedureId, String documentId, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanRead(procedureId, settings, role, username, admin);
        return versionRepository.findByProcedureIdAndDocumentIdOrderByVersionAsc(procedureId, documentId);
    }

    public DocumentVersionDocument uploadDocument(String procedureId, MultipartFile file, String documentId, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanWrite(procedureId, settings, role, username, admin);
        String effectiveDocumentId = documentId == null || documentId.isBlank() ? UUID.randomUUID().toString() : documentId;
        Integer nextVersion = versionRepository.findTopByProcedureIdAndDocumentIdOrderByVersionDesc(procedureId, effectiveDocumentId)
                .map(version -> version.getVersion() + 1)
                .orElse(1);
        String storageKey = fileStorageService.storeFile(file, settings.getAllowedFormats(), settings.getMaxFileSizeMb());
        DocumentVersionDocument saved = versionRepository.save(DocumentVersionDocument.builder()
                .procedureId(procedureId)
                .policyId(settings.getPolicyId())
                .documentId(effectiveDocumentId)
                .version(nextVersion)
                .workingCopyStorageKey(storageKey)
                .workingCopyRevision(0)
                .workingCopyUpdatedAt(LocalDateTime.now())
                .originalFileName(file.getOriginalFilename())
                .storageKey(storageKey)
                .contentType(file.getContentType())
                .size(file.getSize())
                .createdBy(username)
                .traceAction(nextVersion == 1 ? "UPLOAD" : "NEW_VERSION")
                .traceNote(nextVersion == 1 ? "Document uploaded into procedure repository" : "New version uploaded")
                .createdAt(LocalDateTime.now())
                .build());
        return saved;
    }

    public DocumentVersionDocument uploadTaskEvidence(String procedureId, String taskId, String fieldId, MultipartFile file, String username) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ProcedureTaskDocument task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("La tarea no existe."));
        if (!procedureId.equals(task.getProcedureId())) {
            throw new IllegalArgumentException("La tarea no pertenece al trámite.");
        }

        String effectiveFieldId = fieldId == null || fieldId.isBlank() ? UUID.randomUUID().toString() : fieldId.trim();
        String effectiveDocumentId = taskId + "::" + effectiveFieldId;
        Integer nextVersion = versionRepository.findTopByProcedureIdAndDocumentIdOrderByVersionDesc(procedureId, effectiveDocumentId)
                .map(version -> version.getVersion() + 1)
                .orElse(1);
        String storageKey = fileStorageService.storeFile(file, settings.getAllowedFormats(), settings.getMaxFileSizeMb());
        return versionRepository.save(DocumentVersionDocument.builder()
                .procedureId(procedureId)
                .policyId(settings.getPolicyId())
                .documentId(effectiveDocumentId)
                .version(nextVersion)
                .workingCopyStorageKey(storageKey)
                .workingCopyRevision(0)
                .workingCopyUpdatedAt(LocalDateTime.now())
                .originalFileName(file.getOriginalFilename())
                .storageKey(storageKey)
                .contentType(file.getContentType())
                .size(file.getSize())
                .createdBy(username)
                .traceAction("TASK_EVIDENCE")
                .traceNote("Document uploaded as task evidence (taskId=" + taskId + ", fieldId=" + effectiveFieldId + ")")
                .createdAt(LocalDateTime.now())
                .build());
    }

    public Resource downloadDocument(String procedureId, String documentId, Integer version, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanRead(procedureId, settings, role, username, admin);
        DocumentVersionDocument document = versionRepository.findByProcedureIdAndDocumentIdAndVersion(procedureId, documentId, version)
                .orElseThrow(() -> new IllegalArgumentException("No existe la versión solicitada del documento."));
        return fileStorageService.loadFileAsResource(effectiveStorageKey(document));
    }

    public DocumentVersionDocument getVersion(String procedureId, String documentId, Integer version, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanRead(procedureId, settings, role, username, admin);
        return versionRepository.findByProcedureIdAndDocumentIdAndVersion(procedureId, documentId, version)
                .orElseThrow(() -> new IllegalArgumentException("No existe la versión solicitada del documento."));
    }

    public DocumentVersionResponse toResponse(String procedureId, DocumentVersionDocument document, String role, String username, boolean admin) {
        String downloadUri = buildDownloadUri(procedureId, document.getDocumentId(), document.getVersion());
        String onlyOfficeEditorUrl = canEditWithOnlyOffice(procedureId, document, role, username, admin)
                ? buildOnlyOfficeEditorLaunchUrl(procedureId, document.getDocumentId(), document.getVersion())
                : null;

        return new DocumentVersionResponse(
                document.getId(),
                document.getProcedureId(),
                document.getPolicyId(),
                document.getDocumentId(),
                document.getVersion(),
                document.getVersionName(),
                document.getOriginalFileName(),
                document.getStorageKey(),
                document.getContentType(),
                document.getSize(),
                document.getCreatedBy(),
                document.getTraceAction(),
                document.getTraceNote(),
                document.getCreatedAt(),
                downloadUri,
                isOnlyOfficeConfigured() && isOnlyOfficeEditable(document),
                onlyOfficeEditorUrl,
                presenceRegistry.getActiveEditors(procedureId, document.getDocumentId())
        );
    }

    public DocumentVersionDocument requireEditableOnlyOfficeVersion(String procedureId, String documentId, Integer version, String role, String username, boolean admin) {
        DocumentVersionDocument document = getVersion(procedureId, documentId, version, role, username, admin);
        if (!canEditWithOnlyOffice(procedureId, document, role, username, admin)) {
            throw new IllegalArgumentException("OnlyOffice no está disponible para este documento.");
        }
        return document;
    }

    public OnlyOfficeEditorConfigResponse buildOnlyOfficeEditorConfig(String backendBaseUrl,
                                                                       String procedureId,
                                                                       String documentId,
                                                                       Integer version,
                                                                       String role,
                                                                       String username,
                                                                       boolean admin) {
        DocumentVersionDocument document = requireEditableOnlyOfficeVersion(procedureId, documentId, version, role, username, admin);
        if (!isOnlyOfficeConfigured()) {
            throw new IllegalStateException("OnlyOffice no está configurado.");
        }
        String effectiveBackendBaseUrl = normalizeBaseUrl(
                onlyOfficeBackendBaseUrl != null && !onlyOfficeBackendBaseUrl.isBlank()
                        ? onlyOfficeBackendBaseUrl
                        : backendBaseUrl
        );
        String downloadToken = generateOnlyOfficeToken("download", procedureId, documentId, version);
        String callbackToken = generateOnlyOfficeToken("callback", procedureId, documentId, version);

        String downloadUrl = effectiveBackendBaseUrl + "/api/onlyoffice/documents/" + downloadToken;
        String callbackUrl = effectiveBackendBaseUrl + "/api/onlyoffice/callback/" + callbackToken;

        Map<String, Object> permissions = new LinkedHashMap<>();
        permissions.put("edit", true);
        permissions.put("review", true);
        permissions.put("download", true);

        String resolvedExtension = resolvedOfficeExtension(document);

        Map<String, Object> documentConfig = new LinkedHashMap<>();
        documentConfig.put("fileType", resolvedExtension);
        documentConfig.put("key", onlyOfficeKey(procedureId, documentId, version, document.getWorkingCopyRevision()));
        documentConfig.put("title", document.getOriginalFileName() != null && !document.getOriginalFileName().isBlank()
                ? document.getOriginalFileName()
                : documentId + "." + resolvedExtension);
        documentConfig.put("url", downloadUrl);
        documentConfig.put("permissions", permissions);

        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", username);
        user.put("name", username);

        Map<String, Object> editorConfig = new LinkedHashMap<>();
        editorConfig.put("callbackUrl", callbackUrl);
        editorConfig.put("mode", "edit");
        editorConfig.put("user", user);

        Map<String, Object> config = new LinkedHashMap<>();
        config.put("document", documentConfig);
        config.put("documentType", onlyOfficeDocumentType(document));
        config.put("editorConfig", editorConfig);
        config.put("token", buildOnlyOfficeJwt(config));

        return new OnlyOfficeEditorConfigResponse(normalizeBaseUrl(onlyOfficeDocumentServerUrl), config);
    }

    public OnlyOfficeDownloadResponse downloadOnlyOfficeDocument(String token) {
        OnlyOfficeTokenClaims claims = verifyOnlyOfficeToken(token, "download");
        DocumentVersionDocument document = versionRepository.findByProcedureIdAndDocumentIdAndVersion(claims.procedureId(), claims.documentId(), claims.version())
                .orElseThrow(() -> new IllegalArgumentException("No existe la versión solicitada del documento."));
        Resource resource = fileStorageService.loadFileAsResource(effectiveStorageKey(document));
        String contentType = document.getContentType() != null && !document.getContentType().isBlank()
                ? document.getContentType()
                : fileStorageService.getContentType(resource.getFilename()).orElse("application/octet-stream");
        return new OnlyOfficeDownloadResponse(resource, contentType, document.getOriginalFileName() != null && !document.getOriginalFileName().isBlank()
                ? document.getOriginalFileName()
                : resource.getFilename());
    }

    public DocumentVersionDocument publishOnlyOfficeVersion(String procedureId,
                                                            String documentId,
                                                            Integer version,
                                                            String versionName,
                                                            String role,
                                                            String username,
                                                            boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanWrite(procedureId, settings, role, username, admin);

        DocumentVersionDocument sourceVersion = requireEditableOnlyOfficeVersion(procedureId, documentId, version, role, username, admin);
        String sourceStorageKey = effectiveStorageKey(sourceVersion);
        Resource sourceResource = fileStorageService.loadFileAsResource(sourceStorageKey);

        byte[] content;
        try {
            content = sourceResource.getInputStream().readAllBytes();
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo leer el borrador actual.", ex);
        }

        String originalFileName = sourceVersion.getOriginalFileName() != null && !sourceVersion.getOriginalFileName().isBlank()
                ? sourceVersion.getOriginalFileName()
                : sourceResource.getFilename();
        String publishedStorageKey = fileStorageService.storeFile(content, originalFileName, sourceVersion.getContentType(), settings.getAllowedFormats(), settings.getMaxFileSizeMb());
        Integer nextVersion = versionRepository.findTopByProcedureIdAndDocumentIdOrderByVersionDesc(procedureId, documentId)
                .map(existing -> existing.getVersion() + 1)
                .orElse(sourceVersion.getVersion() + 1);

        return versionRepository.save(DocumentVersionDocument.builder()
                .procedureId(sourceVersion.getProcedureId())
                .policyId(sourceVersion.getPolicyId())
                .documentId(sourceVersion.getDocumentId())
                .version(nextVersion)
                .versionName(normalizeVersionName(versionName))
                .originalFileName(originalFileName)
                .storageKey(publishedStorageKey)
                .workingCopyStorageKey(publishedStorageKey)
                .workingCopyRevision(0)
                .workingCopyUpdatedAt(LocalDateTime.now())
                .contentType(sourceVersion.getContentType())
                .size((long) content.length)
                .createdBy(username)
                .traceAction("PUBLISH_VERSION")
                .traceNote("Version publicada desde el borrador actual")
                .createdAt(LocalDateTime.now())
                .build());
    }

    public void handleOnlyOfficeCallback(String token, OnlyOfficeCallbackRequest request) {
        OnlyOfficeTokenClaims claims = verifyOnlyOfficeToken(token, "callback");
        if (request == null || request.status() == null) {
            throw new IllegalArgumentException("Callback inválido.");
        }

        if (request.status() != 2 && request.status() != 6) {
            return;
        }

        if (request.url() == null || request.url().isBlank()) {
            throw new IllegalArgumentException("OnlyOffice no envió la URL del documento actualizado.");
        }

        DocumentVersionDocument sourceVersion = versionRepository.findByProcedureIdAndDocumentIdAndVersion(claims.procedureId(), claims.documentId(), claims.version())
                .orElseThrow(() -> new IllegalArgumentException("No existe la versión base del documento."));
        DocumentRepositorySettingsDocument settings = getSettings(claims.procedureId());

        byte[] editedContent = restTemplate.getForObject(resolveOnlyOfficeInternalUrl(request.url()), byte[].class);
        if (editedContent == null) {
            throw new IllegalStateException("No se pudo descargar el documento editado desde OnlyOffice.");
        }

        String originalFileName = sourceVersion.getOriginalFileName() != null ? sourceVersion.getOriginalFileName() : claims.documentId() + ".docx";
        String storageKey = fileStorageService.storeFile(editedContent, originalFileName, sourceVersion.getContentType(), settings.getAllowedFormats(), settings.getMaxFileSizeMb());
        sourceVersion.setWorkingCopyStorageKey(storageKey);
        sourceVersion.setWorkingCopyRevision(sourceVersion.getWorkingCopyRevision() == null ? 1 : sourceVersion.getWorkingCopyRevision() + 1);
        sourceVersion.setWorkingCopyUpdatedAt(LocalDateTime.now());
        versionRepository.save(sourceVersion);
    }

    public void deleteDocumentVersion(String procedureId, String documentId, Integer version, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanWrite(procedureId, settings, role, username, admin);

        DocumentVersionDocument document = versionRepository.findByProcedureIdAndDocumentIdAndVersion(procedureId, documentId, version)
                .orElseThrow(() -> new IllegalArgumentException("No existe la versión solicitada del documento."));
        
        if (!admin && !username.equals(document.getCreatedBy())) {
            throw new AccessDeniedException("No tenés permiso para eliminar este documento. Solo el autor o un administrador pueden borrarlo.");
        }
        
        deleteStorageKeys(document);

        versionRepository.delete(document);
    }

    private void deleteStorageKeys(DocumentVersionDocument document) {
        if (document.getStorageKey() != null) {
            fileStorageService.deleteFile(document.getStorageKey());
        }

        String workingCopyStorageKey = document.getWorkingCopyStorageKey();
        if (workingCopyStorageKey != null && !workingCopyStorageKey.equals(document.getStorageKey())) {
            fileStorageService.deleteFile(workingCopyStorageKey);
        }
    }

    private void ensureCanRead(String repositoryId, DocumentRepositorySettingsDocument settings, String role, String username, boolean admin) {
        if (isProcedureRepository(repositoryId)) {
            ensureProcedureCanRead(repositoryId, role, username, admin);
            return;
        }

        if (admin) return;
        if ("DESIGNER".equalsIgnoreCase(role)) return;
        if (settings.getAllowedRoles() == null || settings.getAllowedRoles().isEmpty()) return;

        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null || user.getDepartmentIds() == null) {
            throw new AccessDeniedException("El usuario no tiene departamento asignado.");
        }

        boolean hasDepartment = user.getDepartmentIds().stream()
                .anyMatch(deptId -> settings.getAllowedRoles().contains(deptId));

        if (!hasDepartment) {
            throw new AccessDeniedException("El rol o departamento no tiene permiso para consultar este repositorio documental.");
        }
    }

    private void ensureCanWrite(String repositoryId, DocumentRepositorySettingsDocument settings, String role, String username, boolean admin) {
        if (isProcedureRepository(repositoryId)) {
            ensureProcedureCanWrite(repositoryId, role, username, admin);
            return;
        }

        if (admin) return;
        if ("DESIGNER".equalsIgnoreCase(role)) return;
        if (settings.getAllowedRoles() == null || settings.getAllowedRoles().isEmpty()) {
            throw new AccessDeniedException("El repositorio documental no tiene permisos de escritura definidos.");
        }

        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null || user.getDepartmentIds() == null) {
            throw new AccessDeniedException("El usuario no tiene departamento asignado.");
        }

        boolean hasDepartment = user.getDepartmentIds().stream()
                .anyMatch(deptId -> settings.getAllowedRoles().contains(deptId));

        if (!hasDepartment) {
            throw new AccessDeniedException("El rol o departamento no tiene permiso para modificar este repositorio documental.");
        }
    }

    private void ensureProcedureCanRead(String procedureId, String role, String username, boolean admin) {
        if (admin) return;
        if ("DESIGNER".equalsIgnoreCase(role)) return;

        ProcedureDocument procedure = requireProcedure(procedureId);
        if (username.equals(procedure.getCreatedBy())) return;
        if (containsUsername(procedure.getInvitedUsers(), username)) return;
        if (taskRepository.findByProcedureIdOrderByCreatedAtAsc(procedureId).stream().anyMatch(task -> username.equals(task.getAssignedTo()))) return;

        throw new AccessDeniedException("No tenés permiso para consultar este expediente documental.");
    }

    private void ensureProcedureCanWrite(String procedureId, String role, String username, boolean admin) {
        if (admin) return;
        if ("DESIGNER".equalsIgnoreCase(role)) return;

        ProcedureDocument procedure = requireProcedure(procedureId);
        if (username.equals(procedure.getCreatedBy())) return;
        if (containsUsername(procedure.getInvitedUsers(), username)) return;
        if (taskRepository.findByProcedureIdOrderByCreatedAtAsc(procedureId).stream().anyMatch(task -> username.equals(task.getAssignedTo()))) return;

        throw new AccessDeniedException("No tenés permiso para modificar este expediente documental.");
    }

    private boolean isProcedureRepository(String repositoryId) {
        return procedureRepository.findById(repositoryId).isPresent();
    }

    private ProcedureDocument requireProcedure(String procedureId) {
        return procedureRepository.findById(procedureId)
                .orElseThrow(() -> new IllegalArgumentException("Trámite no encontrado."));
    }

    public List<DocumentRepositoryUserResponse> listInvitedUsers(String procedureId, String role, String username, boolean admin) {
        ProcedureDocument procedure = requireProcedure(procedureId);
        ensureProcedureCanRead(procedureId, role, username, admin);
        return invitedUsers(procedure);
    }

    public List<DocumentRepositoryUserResponse> listProcedureParticipants(String procedureId, String role, String username, boolean admin) {
        ProcedureDocument procedure = requireProcedure(procedureId);
        ensureProcedureCanRead(procedureId, role, username, admin);
        return participants(procedure);
    }

    public List<DocumentRepositoryUserResponse> searchInvitableUsers(String procedureId, String query, Integer limit, String role, String username, boolean admin) {
        ensureProcedureExists(procedureId);
        ensureCanManageInvites(procedureId, role, username, admin);

        String loweredQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        int max = limit == null || limit <= 0 ? 8 : Math.min(limit, 20);

        return java.util.stream.StreamSupport.stream(userRepository.findAll().spliterator(), false)
                .filter(User::isActive)
                .filter(user -> loweredQuery.isBlank() || matchesInviteQuery(user, loweredQuery))
                .sorted(java.util.Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                .limit(max)
                .map(DocumentRepositoryService::toUserResponse)
                .toList();
    }

    public List<DocumentRepositoryUserResponse> inviteUser(String procedureId, DocumentRepositoryInviteRequest request, String role, String username, boolean admin) {
        ProcedureDocument procedure = requireProcedure(procedureId);
        ensureCanManageInvites(procedureId, role, username, admin);

        String targetUsername = normalizeUsername(request.username());
        if (!hasText(targetUsername)) {
            throw new IllegalArgumentException("Debés indicar un usuario válido.");
        }

        User target = userRepository.findByUsername(targetUsername)
                .orElseThrow(() -> new IllegalArgumentException("El usuario no existe."));

        List<String> invited = new java.util.ArrayList<>(procedure.getInvitedUsers() == null ? List.of() : procedure.getInvitedUsers());
        if (!invited.contains(target.getUsername())) {
            invited.add(target.getUsername());
            procedure.setInvitedUsers(invited);
            procedureRepository.save(procedure);
        }

        return invitedUsers(procedure);
    }

    public List<DocumentRepositoryUserResponse> revokeUser(String procedureId, String invitedUsername, String role, String username, boolean admin) {
        ProcedureDocument procedure = requireProcedure(procedureId);
        ensureCanManageInvites(procedureId, role, username, admin);

        String targetUsername = normalizeUsername(invitedUsername);
        List<String> invited = new java.util.ArrayList<>(procedure.getInvitedUsers() == null ? List.of() : procedure.getInvitedUsers());
        if (invited.removeIf(targetUsername::equals)) {
            procedure.setInvitedUsers(invited);
            procedureRepository.save(procedure);
        }

        return invitedUsers(procedure);
    }

    private void ensureCanManageInvites(String procedureId, String role, String username, boolean admin) {
        ProcedureDocument procedure = requireProcedure(procedureId);
        ensureProcedureCanWrite(procedureId, role, username, admin);
    }

    private void ensureProcedureExists(String procedureId) {
        requireProcedure(procedureId);
    }

    private List<DocumentRepositoryUserResponse> invitedUsers(ProcedureDocument procedure) {
        List<String> invited = procedure.getInvitedUsers() == null ? List.of() : procedure.getInvitedUsers();
        return invited.stream()
                .map(username -> userRepository.findByUsername(username)
                        .map(DocumentRepositoryService::toUserResponse)
                        .orElse(new DocumentRepositoryUserResponse(null, username, username, "")))
                .toList();
    }

    private List<DocumentRepositoryUserResponse> participants(ProcedureDocument procedure) {
        return taskRepository.findByProcedureIdOrderByCreatedAtAsc(procedure.getId()).stream()
                .map(ProcedureTaskDocument::getAssignedTo)
                .filter(this::hasText)
                .distinct()
                .map(username -> userRepository.findByUsername(username)
                        .map(DocumentRepositoryService::toUserResponse)
                        .orElse(new DocumentRepositoryUserResponse(null, username, username, "")))
                .toList();
    }

    private static DocumentRepositoryUserResponse toUserResponse(User user) {
        return new DocumentRepositoryUserResponse(user.getId(), user.getUsername(), user.getName(), user.getEmail());
    }

    private boolean matchesInviteQuery(User user, String query) {
        return safeLower(user.getUsername()).contains(query)
                || safeLower(user.getEmail()).contains(query)
                || safeLower(user.getName()).contains(query);
    }

    private String normalizeUsername(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean containsUsername(List<String> usernames, String username) {
        return usernames != null && usernames.stream().anyMatch(username::equals);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private boolean canEditWithOnlyOffice(String procedureId, DocumentVersionDocument document, String role, String username, boolean admin) {
        if (!isOnlyOfficeEditable(document)) {
            return false;
        }
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        try {
            ensureCanWrite(procedureId, settings, role, username, admin);
            return true;
        } catch (AccessDeniedException ex) {
            return false;
        }
    }

    private boolean isOnlyOfficeEditable(DocumentVersionDocument document) {
        return isOnlyOfficeConfigured()
                && ONLYOFFICE_EDITABLE_EXTENSIONS.contains(resolvedOfficeExtension(document));
    }

    private boolean isOnlyOfficeConfigured() {
        return onlyOfficeEnabled
                && onlyOfficeDocumentServerUrl != null && !onlyOfficeDocumentServerUrl.isBlank()
                && onlyOfficeSharedSecret != null && !onlyOfficeSharedSecret.isBlank();
    }

    private String buildOnlyOfficeEditorLaunchUrl(String procedureId, String documentId, Integer version) {
        return normalizeBaseUrl(frontendBaseUrl) + "/documents/" + procedureId + "/" + documentId + "/versions/" + version + "/editor";
    }

    private String buildDownloadUri(String procedureId, String documentId, Integer version) {
        return "/api/procedures/" + procedureId + "/documents/" + documentId + "/versions/" + version;
    }

    private String fileExtension(String originalFileName) {
        if (originalFileName == null || originalFileName.isBlank()) {
            return "";
        }
        int lastDotIndex = originalFileName.lastIndexOf('.');
        return lastDotIndex >= 0 ? originalFileName.substring(lastDotIndex + 1).toLowerCase(Locale.ROOT) : "";
    }

    private String onlyOfficeDocumentType(DocumentVersionDocument document) {
        return switch (resolvedOfficeExtension(document)) {
            case "xlsx", "csv" -> "cell";
            case "pptx" -> "slide";
            default -> "word";
        };
    }

    private String resolvedOfficeExtension(DocumentVersionDocument document) {
        String extension = fileExtension(document.getOriginalFileName());
        if (ONLYOFFICE_EDITABLE_EXTENSIONS.contains(extension)) {
            return extension;
        }

        String storageExtension = fileExtension(document.getStorageKey());
        if (ONLYOFFICE_EDITABLE_EXTENSIONS.contains(storageExtension)) {
            return storageExtension;
        }

        String contentType = document.getContentType() == null ? "" : document.getContentType().toLowerCase(Locale.ROOT);
        if (contentType.contains("spreadsheetml.sheet") || contentType.contains("ms-excel") || contentType.contains("excel")) {
            return "xlsx";
        }
        if (contentType.contains("presentationml.presentation") || contentType.contains("ms-powerpoint") || contentType.contains("presentation")) {
            return "pptx";
        }

        if ("text/csv".equals(contentType) || "application/csv".equals(contentType) || contentType.contains("comma-separated-values")) {
            return "csv";
        }

        return extension;
    }

    private String onlyOfficeKey(String procedureId, String documentId, Integer version, Integer workingCopyRevision) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((procedureId + "|" + documentId + "|" + version + "|" + (workingCopyRevision == null ? 0 : workingCopyRevision)).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return "oo-" + hex;
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo construir la key segura de OnlyOffice.", ex);
        }
    }

    private String effectiveStorageKey(DocumentVersionDocument document) {
        return document.getWorkingCopyStorageKey() != null && !document.getWorkingCopyStorageKey().isBlank()
                ? document.getWorkingCopyStorageKey()
                : document.getStorageKey();
    }

    private String normalizeVersionName(String versionName) {
        return versionName == null ? null : versionName.trim();
    }

    private String generateOnlyOfficeToken(String purpose, String procedureId, String documentId, Integer version) {
        long expiresAt = Instant.now().plus(onlyOfficeTokenTtlMinutes, ChronoUnit.MINUTES).toEpochMilli();
        String payload = String.join("|", purpose, procedureId, documentId, String.valueOf(version), String.valueOf(expiresAt));
        return encodeToken(payload);
    }

    private OnlyOfficeTokenClaims verifyOnlyOfficeToken(String token, String expectedPurpose) {
        if (onlyOfficeSharedSecret == null || onlyOfficeSharedSecret.isBlank()) {
            throw new IllegalStateException("OnlyOffice no está configurado.");
        }
        String payload = decodeToken(token);
        String[] parts = payload.split("\\|", -1);
        if (parts.length != 5) {
            throw new IllegalArgumentException("Token OnlyOffice inválido.");
        }
        if (!expectedPurpose.equals(parts[0])) {
            throw new IllegalArgumentException("Token OnlyOffice con propósito inválido.");
        }
        long expiresAt = Long.parseLong(parts[4]);
        if (Instant.now().toEpochMilli() > expiresAt) {
            throw new IllegalArgumentException("Token OnlyOffice vencido.");
        }
        return new OnlyOfficeTokenClaims(parts[0], parts[1], parts[2], Integer.parseInt(parts[3]), expiresAt);
    }

    private String encodeToken(String payload) {
        String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String signature = sign(encodedPayload);
        return encodedPayload + "." + signature;
    }

    private String decodeToken(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Token OnlyOffice vacío.");
        }
        String[] parts = token.split("\\.", 2);
        if (parts.length != 2) {
            throw new IllegalArgumentException("Token OnlyOffice inválido.");
        }
        String expectedSignature = sign(parts[0]);
        if (!MessageDigest.isEqual(expectedSignature.getBytes(StandardCharsets.UTF_8), parts[1].getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalArgumentException("Token OnlyOffice inválido.");
        }
        return new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(onlyOfficeSharedSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo firmar el token OnlyOffice.", ex);
        }
    }

    private List<String> normalizeList(List<String> values) {
        if (values == null) return List.of();
        return values.stream().filter(Objects::nonNull).map(value -> value.trim()).filter(value -> !value.isBlank()).toList();
    }

    private String buildOnlyOfficeJwt(Map<String, Object> payload) {
        try {
            Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
            String encodedHeader = Base64.getUrlEncoder().withoutPadding().encodeToString(objectMapper.writeValueAsBytes(header));
            String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(objectMapper.writeValueAsBytes(payload));
            String signature = sign(encodedHeader + "." + encodedPayload);
            return encodedHeader + "." + encodedPayload + "." + signature;
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo construir el token OnlyOffice.", ex);
        }
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "";
        }
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private String resolveOnlyOfficeInternalUrl(String externalUrl) {
        String internalBaseUrl = normalizeBaseUrl(onlyOfficeInternalDocumentServerUrl);
        if (internalBaseUrl.isBlank()) {
            return externalUrl;
        }

        String publicBaseUrl = normalizeBaseUrl(onlyOfficeDocumentServerUrl);
        if (!publicBaseUrl.isBlank() && externalUrl.startsWith(publicBaseUrl)) {
            return internalBaseUrl + externalUrl.substring(publicBaseUrl.length());
        }

        try {
            java.net.URI uri = java.net.URI.create(externalUrl);
            if ("localhost".equalsIgnoreCase(uri.getHost()) || "127.0.0.1".equals(uri.getHost())) {
                StringBuilder resolved = new StringBuilder(internalBaseUrl);
                if (uri.getRawPath() != null) {
                    resolved.append(uri.getRawPath());
                }
                if (uri.getRawQuery() != null && !uri.getRawQuery().isBlank()) {
                    resolved.append('?').append(uri.getRawQuery());
                }
                if (uri.getRawFragment() != null && !uri.getRawFragment().isBlank()) {
                    resolved.append('#').append(uri.getRawFragment());
                }
                return resolved.toString();
            }
        } catch (IllegalArgumentException ignored) {
            // Fall back to the external URL if it cannot be parsed.
        }

        return externalUrl;
    }

    private record OnlyOfficeTokenClaims(String purpose, String procedureId, String documentId, Integer version, long expiresAt) {
    }
}

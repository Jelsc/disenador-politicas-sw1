package com.tuapp.backend.documents.application;

import com.tuapp.backend.documents.domain.DocumentRepositorySettingsDocument;
import com.tuapp.backend.documents.domain.DocumentVersionDocument;
import com.tuapp.backend.documents.infrastructure.DocumentRepositorySettingsMongoRepository;
import com.tuapp.backend.documents.infrastructure.DocumentVersionMongoRepository;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositorySettingsRequest;
import com.tuapp.backend.shared.infrastructure.storage.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DocumentRepositoryService {

    private final FileStorageService fileStorageService;
    private final DocumentRepositorySettingsMongoRepository settingsRepository;
    private final DocumentVersionMongoRepository versionRepository;
    private final UserRepository userRepository;

    public DocumentRepositoryService(FileStorageService fileStorageService,
                                     DocumentRepositorySettingsMongoRepository settingsRepository,
                                     DocumentVersionMongoRepository versionRepository,
                                     UserRepository userRepository) {
        this.fileStorageService = fileStorageService;
        this.settingsRepository = settingsRepository;
        this.versionRepository = versionRepository;
        this.userRepository = userRepository;
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
        ensureCanRead(settings, role, username, admin);
        List<DocumentVersionDocument> all = versionRepository.findByProcedureIdOrderByCreatedAtDesc(procedureId);
        Map<String, DocumentVersionDocument> latestByDocument = new LinkedHashMap<>();
        for (DocumentVersionDocument version : all) {
            latestByDocument.putIfAbsent(version.getDocumentId(), version);
        }
        return List.copyOf(latestByDocument.values());
    }

    public List<DocumentVersionDocument> listVersions(String procedureId, String documentId, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanRead(settings, role, username, admin);
        return versionRepository.findByProcedureIdAndDocumentIdOrderByVersionAsc(procedureId, documentId);
    }

    public DocumentVersionDocument uploadDocument(String procedureId, MultipartFile file, String documentId, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanWrite(settings, role, username, admin);
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

    public DocumentVersionDocument uploadTaskEvidence(String procedureId, MultipartFile file, String documentId, String username) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        String effectiveDocumentId = documentId == null || documentId.isBlank() ? UUID.randomUUID().toString() : documentId;
        Integer nextVersion = versionRepository.findTopByProcedureIdAndDocumentIdOrderByVersionDesc(procedureId, effectiveDocumentId)
                .map(version -> version.getVersion() + 1)
                .orElse(1);
        String storageKey = fileStorageService.storeFile(file, settings.getAllowedFormats(), settings.getMaxFileSizeMb());
        return versionRepository.save(DocumentVersionDocument.builder()
                .procedureId(procedureId)
                .policyId(settings.getPolicyId())
                .documentId(effectiveDocumentId)
                .version(nextVersion)
                .originalFileName(file.getOriginalFilename())
                .storageKey(storageKey)
                .contentType(file.getContentType())
                .size(file.getSize())
                .createdBy(username)
                .traceAction("TASK_EVIDENCE")
                .traceNote("Document uploaded as task evidence")
                .createdAt(LocalDateTime.now())
                .build());
    }

    public Resource downloadDocument(String procedureId, String documentId, Integer version, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanRead(settings, role, username, admin);
        DocumentVersionDocument document = versionRepository.findByProcedureIdAndDocumentIdAndVersion(procedureId, documentId, version)
                .orElseThrow(() -> new IllegalArgumentException("No existe la versión solicitada del documento."));
        return fileStorageService.loadFileAsResource(document.getStorageKey());
    }

    public DocumentVersionDocument getVersion(String procedureId, String documentId, Integer version, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanRead(settings, role, username, admin);
        return versionRepository.findByProcedureIdAndDocumentIdAndVersion(procedureId, documentId, version)
                .orElseThrow(() -> new IllegalArgumentException("No existe la versión solicitada del documento."));
    }

    public void deleteDocumentVersion(String procedureId, String documentId, Integer version, String role, String username, boolean admin) {
        DocumentRepositorySettingsDocument settings = getSettings(procedureId);
        ensureCanWrite(settings, role, username, admin);
        
        DocumentVersionDocument document = versionRepository.findByProcedureIdAndDocumentIdAndVersion(procedureId, documentId, version)
                .orElseThrow(() -> new IllegalArgumentException("No existe la versión solicitada del documento."));
        
        if (!admin && !username.equals(document.getCreatedBy())) {
            throw new AccessDeniedException("No tenés permiso para eliminar este documento. Solo el autor o un administrador pueden borrarlo.");
        }
        
        if (document.getStorageKey() != null) {
            fileStorageService.deleteFile(document.getStorageKey());
        }
        
        versionRepository.delete(document);
    }

    private void ensureCanRead(DocumentRepositorySettingsDocument settings, String role, String username, boolean admin) {
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

    private void ensureCanWrite(DocumentRepositorySettingsDocument settings, String role, String username, boolean admin) {
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

    private List<String> normalizeList(List<String> values) {
        if (values == null) return List.of();
        return values.stream().filter(Objects::nonNull).map(value -> value.trim()).filter(value -> !value.isBlank()).toList();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}

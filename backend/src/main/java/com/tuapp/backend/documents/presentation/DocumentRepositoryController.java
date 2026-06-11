package com.tuapp.backend.documents.presentation;

import com.tuapp.backend.documents.application.DocumentRepositoryService;
import com.tuapp.backend.documents.domain.DocumentRepositorySettingsDocument;
import com.tuapp.backend.documents.domain.DocumentVersionDocument;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositorySettingsRequest;
import com.tuapp.backend.documents.presentation.dto.DocumentVersionResponse;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/api/procedures/{procedureId}/documents")
public class DocumentRepositoryController {

    private final DocumentRepositoryService service;

    public DocumentRepositoryController(DocumentRepositoryService service) {
        this.service = service;
    }

    @PutMapping("/settings")
    public ResponseEntity<DocumentRepositorySettingsDocument> upsertSettings(@PathVariable String procedureId,
                                                                             @Valid @RequestBody DocumentRepositorySettingsRequest request,
                                                                             Authentication authentication) {
        return ResponseEntity.ok(service.upsertSettings(procedureId, request, username(authentication), isAdmin(authentication)));
    }

    @GetMapping("/settings")
    public ResponseEntity<DocumentRepositorySettingsDocument> getSettings(@PathVariable String procedureId) {
        return ResponseEntity.ok(service.getSettings(procedureId));
    }

    @GetMapping
    public ResponseEntity<List<DocumentVersionResponse>> listLatest(@PathVariable String procedureId, Authentication authentication) {
        return ResponseEntity.ok(service.listLatestDocuments(procedureId, role(authentication), isAdmin(authentication))
                .stream().map(document -> toResponse(procedureId, document)).toList());
    }

    @GetMapping("/{documentId}/versions")
    public ResponseEntity<List<DocumentVersionDocument>> listVersions(@PathVariable String procedureId,
                                                                      @PathVariable String documentId,
                                                                      Authentication authentication) {
        return ResponseEntity.ok(service.listVersions(procedureId, documentId, role(authentication), isAdmin(authentication)));
    }

    @PostMapping
    public ResponseEntity<DocumentVersionResponse> upload(@PathVariable String procedureId,
                                                          @RequestParam("file") MultipartFile file,
                                                          @RequestParam(value = "documentId", required = false) String documentId,
                                                          Authentication authentication) {
        DocumentVersionDocument saved = service.uploadDocument(procedureId, file, documentId, role(authentication), username(authentication), isAdmin(authentication));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(procedureId, saved));
    }

    @GetMapping("/{documentId}/versions/{version}")
    public ResponseEntity<Resource> download(@PathVariable String procedureId,
                                             @PathVariable String documentId,
                                             @PathVariable Integer version,
                                             Authentication authentication,
                                             HttpServletRequest request) {
        Resource resource = service.downloadDocument(procedureId, documentId, version, role(authentication), isAdmin(authentication));
        DocumentVersionDocument metadata = service.getVersion(procedureId, documentId, version, role(authentication), isAdmin(authentication));
        String contentType = metadata.getContentType() != null && !metadata.getContentType().isBlank()
                ? metadata.getContentType()
                : (request.getServletContext().getMimeType(resource.getFilename()) != null ? request.getServletContext().getMimeType(resource.getFilename()) : "application/octet-stream");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }

    @DeleteMapping("/{documentId}/versions/{version}")
    public ResponseEntity<Void> deleteVersion(@PathVariable String procedureId,
                                              @PathVariable String documentId,
                                              @PathVariable Integer version,
                                              Authentication authentication) {
        service.deleteDocumentVersion(procedureId, documentId, version, role(authentication), username(authentication), isAdmin(authentication));
        return ResponseEntity.noContent().build();
    }

    private DocumentVersionResponse toResponse(String procedureId, DocumentVersionDocument document) {
        String downloadUri = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/procedures/")
                .path(procedureId)
                .path("/documents/")
                .path(document.getDocumentId())
                .path("/versions/")
                .path(String.valueOf(document.getVersion()))
                .toUriString();
        return new DocumentVersionResponse(
                document.getId(),
                document.getProcedureId(),
                document.getPolicyId(),
                document.getDocumentId(),
                document.getVersion(),
                document.getOriginalFileName(),
                document.getStorageKey(),
                document.getContentType(),
                document.getSize(),
                document.getCreatedBy(),
                document.getTraceAction(),
                document.getTraceNote(),
                document.getCreatedAt(),
                downloadUri
        );
    }

    private String username(Authentication authentication) {
        return authentication == null ? "anonymous" : authentication.getName();
    }

    private String role(Authentication authentication) {
        if (authentication == null) return "";
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority().replace("ROLE_", ""))
                .findFirst()
                .orElse("");
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}

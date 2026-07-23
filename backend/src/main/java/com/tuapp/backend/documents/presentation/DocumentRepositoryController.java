package com.tuapp.backend.documents.presentation;

import com.tuapp.backend.documents.application.DocumentRepositoryService;
import com.tuapp.backend.documents.domain.DocumentRepositorySettingsDocument;
import com.tuapp.backend.documents.domain.DocumentVersionDocument;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositoryInviteRequest;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositoryUserResponse;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositorySettingsRequest;
import com.tuapp.backend.documents.presentation.dto.DocumentVersionPublishRequest;
import com.tuapp.backend.documents.presentation.dto.DocumentVersionResponse;
import com.tuapp.backend.documents.presentation.dto.OnlyOfficeEditorConfigResponse;
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
        String role = role(authentication);
        String username = username(authentication);
        boolean admin = isAdmin(authentication);
        return ResponseEntity.ok(service.listLatestDocuments(procedureId, role, username, admin)
                .stream().map(document -> service.toResponse(procedureId, document, role, username, admin)).toList());
    }

    @GetMapping("/{documentId}/versions")
    public ResponseEntity<List<DocumentVersionResponse>> listVersions(@PathVariable String procedureId,
                                                                      @PathVariable String documentId,
                                                                      Authentication authentication) {
        String role = role(authentication);
        String username = username(authentication);
        boolean admin = isAdmin(authentication);
        return ResponseEntity.ok(service.listVersions(procedureId, documentId, role, username, admin)
                .stream().map(document -> service.toResponse(procedureId, document, role, username, admin)).toList());
    }

    @GetMapping("/{documentId}/versions/{version}/onlyoffice-config")
    public ResponseEntity<OnlyOfficeEditorConfigResponse> onlyOfficeConfig(@PathVariable String procedureId,
                                                                            @PathVariable String documentId,
                                                                            @PathVariable Integer version,
                                                                            Authentication authentication,
                                                                            HttpServletRequest request) {
        String backendBaseUrl = ServletUriComponentsBuilder.fromRequestUri(request)
                .replacePath(request.getContextPath())
                .replaceQuery(null)
                .build()
                .toUriString();
        return ResponseEntity.ok(service.buildOnlyOfficeEditorConfig(backendBaseUrl, procedureId, documentId, version, role(authentication), username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/{documentId}/versions/{version}/publish")
    public ResponseEntity<DocumentVersionResponse> publishVersion(@PathVariable String procedureId,
                                                                  @PathVariable String documentId,
                                                                  @PathVariable Integer version,
                                                                  @Valid @RequestBody DocumentVersionPublishRequest request,
                                                                  Authentication authentication) {
        String role = role(authentication);
        String username = username(authentication);
        boolean admin = isAdmin(authentication);
        DocumentVersionDocument published = service.publishOnlyOfficeVersion(procedureId, documentId, version, request.versionName(), role, username, admin);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.toResponse(procedureId, published, role, username, admin));
    }

    @PostMapping
    public ResponseEntity<DocumentVersionResponse> upload(@PathVariable String procedureId,
                                                          @RequestParam("file") MultipartFile file,
                                                          @RequestParam(value = "documentId", required = false) String documentId,
                                                          Authentication authentication) {
        String role = role(authentication);
        String username = username(authentication);
        boolean admin = isAdmin(authentication);
        DocumentVersionDocument saved = service.uploadDocument(procedureId, file, documentId, role, username, admin);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.toResponse(procedureId, saved, role, username, admin));
    }

    @GetMapping("/{documentId}/versions/{version}")
    public ResponseEntity<Resource> download(@PathVariable String procedureId,
                                             @PathVariable String documentId,
                                             @PathVariable Integer version,
                                             Authentication authentication,
                                             HttpServletRequest request) {
        Resource resource = service.downloadDocument(procedureId, documentId, version, role(authentication), username(authentication), isAdmin(authentication));
        DocumentVersionDocument metadata = service.getVersion(procedureId, documentId, version, role(authentication), username(authentication), isAdmin(authentication));
        String contentType = metadata.getContentType() != null && !metadata.getContentType().isBlank()
                ? metadata.getContentType()
                : (request.getServletContext().getMimeType(resource.getFilename()) != null ? request.getServletContext().getMimeType(resource.getFilename()) : "application/octet-stream");
        String fileName = metadata.getOriginalFileName() != null && !metadata.getOriginalFileName().isBlank() ? metadata.getOriginalFileName() : resource.getFilename();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
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

    @GetMapping("/invites")
    public ResponseEntity<List<DocumentRepositoryUserResponse>> listInvitedUsers(@PathVariable String procedureId,
                                                                                 Authentication authentication) {
        return ResponseEntity.ok(service.listInvitedUsers(procedureId, role(authentication), username(authentication), isAdmin(authentication)));
    }

    @GetMapping("/participants")
    public ResponseEntity<List<DocumentRepositoryUserResponse>> listProcedureParticipants(@PathVariable String procedureId,
                                                                                          Authentication authentication) {
        return ResponseEntity.ok(service.listProcedureParticipants(procedureId, role(authentication), username(authentication), isAdmin(authentication)));
    }

    @GetMapping("/invites/search")
    public ResponseEntity<List<DocumentRepositoryUserResponse>> searchInvitableUsers(@PathVariable String procedureId,
                                                                                     @RequestParam(required = false, name = "q") String query,
                                                                                     @RequestParam(required = false, defaultValue = "8") Integer limit,
                                                                                     Authentication authentication) {
        return ResponseEntity.ok(service.searchInvitableUsers(procedureId, query, limit, role(authentication), username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/invites")
    public ResponseEntity<List<DocumentRepositoryUserResponse>> inviteUser(@PathVariable String procedureId,
                                                                           @Valid @RequestBody DocumentRepositoryInviteRequest request,
                                                                           Authentication authentication) {
        return ResponseEntity.ok(service.inviteUser(procedureId, request, role(authentication), username(authentication), isAdmin(authentication)));
    }

    @DeleteMapping("/invites/{invitedUsername}")
    public ResponseEntity<List<DocumentRepositoryUserResponse>> revokeUser(@PathVariable String procedureId,
                                                                           @PathVariable String invitedUsername,
                                                                           Authentication authentication) {
        return ResponseEntity.ok(service.revokeUser(procedureId, invitedUsername, role(authentication), username(authentication), isAdmin(authentication)));
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

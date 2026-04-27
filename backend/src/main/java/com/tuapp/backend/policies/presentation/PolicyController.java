package com.tuapp.backend.policies.presentation;

import com.tuapp.backend.policies.application.PolicyService;
import com.tuapp.backend.policies.application.PolicyEditorCandidateResponse;
import com.tuapp.backend.policies.application.PolicyInvitationNotificationResponse;
import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.policies.infrastructure.PolicyAutosaveDocument;
import com.tuapp.backend.policies.infrastructure.PolicyChangeLogDocument;
import com.tuapp.backend.policies.infrastructure.PolicyVersionDocument;
import com.tuapp.backend.policies.presentation.dto.PolicyAutosaveRequest;
import com.tuapp.backend.policies.presentation.dto.PolicyChangeLogRequest;
import com.tuapp.backend.policies.presentation.dto.PolicyEditorsRequest;
import com.tuapp.backend.policies.presentation.dto.PolicyRequest;
import com.tuapp.backend.policies.presentation.dto.PolicyVersionRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/policies")
@PreAuthorize("hasRole('DESIGNER') or hasRole('ADMIN')")
public class PolicyController {

    private final PolicyService policyService;

    public PolicyController(PolicyService policyService) {
        this.policyService = policyService;
    }

    @GetMapping
    public ResponseEntity<List<Policy>> getAllPolicies(Authentication authentication) {
        return ResponseEntity.ok(policyService.getAllPolicies(username(authentication), isAdmin(authentication)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Policy> getPolicyById(@PathVariable String id, Authentication authentication) {
        return ResponseEntity.ok(policyService.getPolicyById(id, username(authentication), isAdmin(authentication)));
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<PolicyVersionDocument>> getPolicyVersions(@PathVariable String id, Authentication authentication) {
        return ResponseEntity.ok(policyService.getPolicyVersions(id, username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/{id}/versions")
    public ResponseEntity<PolicyVersionDocument> createNamedVersion(@PathVariable String id,
                                                                    @RequestBody PolicyVersionRequest request,
                                                                    Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(policyService.createNamedVersion(id, request, username(authentication), isAdmin(authentication)));
    }

    @GetMapping("/eligible-editors")
    public ResponseEntity<List<PolicyEditorCandidateResponse>> getEligibleEditors(Authentication authentication) {
        return ResponseEntity.ok(policyService.getEligibleEditors(username(authentication), isAdmin(authentication)));
    }

    @GetMapping("/pending-invitations")
    public ResponseEntity<List<PolicyInvitationNotificationResponse>> getPendingInvitations(Authentication authentication) {
        return ResponseEntity.ok(policyService.getPendingInvitations(username(authentication)));
    }

    @GetMapping("/{id}/autosave")
    public ResponseEntity<PolicyAutosaveDocument> getLatestAutosave(@PathVariable String id, Authentication authentication) {
        return ResponseEntity.ok(policyService.getLatestAutosave(id, username(authentication), isAdmin(authentication)));
    }

    @PutMapping("/{id}/autosave")
    public ResponseEntity<PolicyAutosaveDocument> saveAutosave(@PathVariable String id,
                                                               @RequestBody PolicyAutosaveRequest request,
                                                               Authentication authentication) {
        return ResponseEntity.ok(policyService.saveAutosave(id, request, username(authentication), isAdmin(authentication)));
    }

    @GetMapping("/{id}/changes")
    public ResponseEntity<List<PolicyChangeLogDocument>> getPolicyChanges(@PathVariable String id, Authentication authentication) {
        return ResponseEntity.ok(policyService.getChangeLogs(id, username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/{id}/changes")
    public ResponseEntity<PolicyChangeLogDocument> recordPolicyChange(@PathVariable String id,
                                                                      @RequestBody PolicyChangeLogRequest request,
                                                                      Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(policyService.recordChange(id, request, username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public ResponseEntity<Policy> restorePolicyVersion(@PathVariable String id, @PathVariable String versionId, Authentication authentication) {
        return ResponseEntity.ok(policyService.restorePolicyVersion(id, versionId, username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/{id}/versions/{versionId}/publish")
    public ResponseEntity<Policy> publishPolicyVersion(@PathVariable String id, @PathVariable String versionId, Authentication authentication) {
        return ResponseEntity.ok(policyService.publishVersion(id, versionId, username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/{id}/versions/{versionId}/duplicate")
    public ResponseEntity<Policy> duplicatePolicyVersion(@PathVariable String id, @PathVariable String versionId, Authentication authentication) {
        return ResponseEntity.ok(policyService.duplicateVersionAsDraft(id, versionId, username(authentication), isAdmin(authentication)));
    }

    @DeleteMapping("/{id}/versions/{versionId}")
    public ResponseEntity<Void> deletePolicyVersion(@PathVariable String id, @PathVariable String versionId, Authentication authentication) {
        policyService.deleteVersion(id, versionId, username(authentication), isAdmin(authentication));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/clone")
    public ResponseEntity<Policy> clonePolicy(@PathVariable String id, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(policyService.clonePolicy(id, username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<Policy> archivePolicy(@PathVariable String id, Authentication authentication) {
        return ResponseEntity.ok(policyService.archivePolicy(id, username(authentication), isAdmin(authentication)));
    }

    @PostMapping
    public ResponseEntity<Policy> createPolicy(@Valid @RequestBody PolicyRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(policyService.createPolicy(request, username(authentication)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Policy> updatePolicy(@PathVariable String id, @Valid @RequestBody PolicyRequest request, Authentication authentication) {
        return ResponseEntity.ok(policyService.updatePolicy(id, request, username(authentication), isAdmin(authentication)));
    }

    @PutMapping("/{id}/editors")
    public ResponseEntity<Policy> updatePolicyEditors(@PathVariable String id,
                                                      @RequestBody PolicyEditorsRequest request,
                                                      Authentication authentication) {
        return ResponseEntity.ok(policyService.updatePolicyEditors(id, request.getEditors(), username(authentication), isAdmin(authentication)));
    }

    @PostMapping("/{id}/invitations/respond")
    public ResponseEntity<Policy> respondToInvitation(@PathVariable String id,
                                                      @RequestParam String decision,
                                                      Authentication authentication) {
        return ResponseEntity.ok(policyService.respondToInvitation(id, username(authentication), decision));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePolicy(@PathVariable String id, Authentication authentication) {
        policyService.deletePolicy(id, username(authentication), isAdmin(authentication));
        return ResponseEntity.noContent().build();
    }

    private String username(Authentication authentication) {
        return authentication == null ? "anonymous" : authentication.getName();
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}

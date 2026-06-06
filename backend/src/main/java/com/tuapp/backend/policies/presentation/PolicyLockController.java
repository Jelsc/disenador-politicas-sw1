package com.tuapp.backend.policies.presentation;

import com.tuapp.backend.policies.application.PolicyEditLockService;
import com.tuapp.backend.policies.collaboration.lock.PolicyEditLock;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/policies/{policyId}/lock")
@PreAuthorize("hasRole('DESIGNER') or hasRole('ADMIN')")
public class PolicyLockController {

    private final PolicyEditLockService lockService;

    public PolicyLockController(PolicyEditLockService lockService) {
        this.lockService = lockService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> acquire(@PathVariable @NotBlank String policyId, Authentication authentication) {
        PolicyEditLock lock = lockService.acquire(policyId, username(authentication));
        return ResponseEntity.ok(toResponse(lock));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> status(@PathVariable @NotBlank String policyId) {
        return ResponseEntity.ok(lockService.status(policyId).map(this::toResponse).orElse(Map.<String, Object>of("locked", false)));
    }

    @DeleteMapping
    public ResponseEntity<Void> release(@PathVariable @NotBlank String policyId, Authentication authentication) {
        lockService.release(policyId, username(authentication));
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toResponse(PolicyEditLock lock) {
        return Map.of(
                "locked", true,
                "policyId", lock.policyId(),
                "username", lock.username(),
                "acquiredAt", lock.acquiredAt().toString(),
                "expiresAt", lock.expiresAt().toString()
        );
    }

    private String username(Authentication authentication) {
        return authentication == null ? "anonymous" : authentication.getName();
    }
}

package com.tuapp.backend.policies.presentation;

import com.tuapp.backend.policies.application.PolicyService;
import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.policies.presentation.dto.PolicyRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
    public ResponseEntity<List<Policy>> getAllPolicies() {
        return ResponseEntity.ok(policyService.getAllPolicies());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Policy> getPolicyById(@PathVariable String id) {
        return ResponseEntity.ok(policyService.getPolicyById(id));
    }

    @PostMapping
    public ResponseEntity<Policy> createPolicy(@Valid @RequestBody PolicyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(policyService.createPolicy(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Policy> updatePolicy(@PathVariable String id, @Valid @RequestBody PolicyRequest request) {
        return ResponseEntity.ok(policyService.updatePolicy(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePolicy(@PathVariable String id) {
        policyService.deletePolicy(id);
        return ResponseEntity.noContent().build();
    }
}

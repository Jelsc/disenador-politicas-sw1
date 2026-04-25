package com.tuapp.backend.policies.application;

import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.policies.domain.PolicyRepository;
import com.tuapp.backend.policies.presentation.dto.PolicyRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PolicyService {

    private final PolicyRepository repository;

    public PolicyService(PolicyRepository repository) {
        this.repository = repository;
    }

    public List<Policy> getAllPolicies() {
        return repository.findAll();
    }

    public Policy getPolicyById(String id) {
        return repository.findById(id).orElseThrow(() -> new RuntimeException("Policy not found"));
    }

    public Policy createPolicy(PolicyRequest request) {
        Policy policy = Policy.builder()
                .name(request.getName())
                .description(request.getDescription())
                .status(request.getStatus() != null ? request.getStatus() : "DRAFT")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        return repository.save(policy);
    }

    public Policy updatePolicy(String id, PolicyRequest request) {
        Policy existing = getPolicyById(id);
        existing.setName(request.getName());
        existing.setDescription(request.getDescription());
        if (request.getStatus() != null) {
            existing.setStatus(request.getStatus());
        }
        existing.setUpdatedAt(LocalDateTime.now());
        return repository.save(existing);
    }

    public void deletePolicy(String id) {
        repository.deleteById(id);
    }
}

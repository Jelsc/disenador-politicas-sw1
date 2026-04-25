package com.tuapp.backend.policies.application;

import com.tuapp.backend.policies.domain.model.Policy;
import com.tuapp.backend.policies.domain.model.PolicyStatus;
import com.tuapp.backend.policies.domain.repository.PolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PolicyUseCases {

    private final PolicyRepository policyRepository;

    public PolicyResponse createPolicy(CreatePolicyRequest request) {
        Policy policy = Policy.builder()
                .name(request.getName())
                .description(request.getDescription())
                .rules(request.getRules())
                .status(PolicyStatus.DRAFT)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Policy saved = policyRepository.save(policy);
        return mapToResponse(saved);
    }

    public List<PolicyResponse> listPolicies() {
        return policyRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public PolicyResponse getPolicy(String id) {
        Policy policy = policyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Policy not found with id: " + id));
        return mapToResponse(policy);
    }

    public void deletePolicy(String id) {
        policyRepository.deleteById(id);
    }

    private PolicyResponse mapToResponse(Policy policy) {
        return PolicyResponse.builder()
                .id(policy.getId())
                .name(policy.getName())
                .description(policy.getDescription())
                .rules(policy.getRules())
                .status(policy.getStatus())
                .createdAt(policy.getCreatedAt())
                .updatedAt(policy.getUpdatedAt())
                .build();
    }
}

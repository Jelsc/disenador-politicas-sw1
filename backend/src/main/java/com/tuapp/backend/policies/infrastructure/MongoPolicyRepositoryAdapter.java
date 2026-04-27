package com.tuapp.backend.policies.infrastructure;

import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.policies.domain.PolicyRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class MongoPolicyRepositoryAdapter implements PolicyRepository {

    private final PolicyMongoRepository repository;

    public MongoPolicyRepositoryAdapter(PolicyMongoRepository repository) {
        this.repository = repository;
    }

    @Override
    public Policy save(Policy policy) {
        if (policy.getCreatedAt() == null) {
            policy.setCreatedAt(LocalDateTime.now());
        }
        policy.setUpdatedAt(LocalDateTime.now());
        
        PolicyDocument document = toDocument(policy);
        PolicyDocument saved = repository.save(document);
        return toDomain(saved);
    }

    @Override
    public Optional<Policy> findById(String id) {
        return repository.findById(id).map(this::toDomain);
    }

    @Override
    public List<Policy> findAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Override
    public void deleteById(String id) {
        repository.deleteById(id);
    }

    private PolicyDocument toDocument(Policy domain) {
        if (domain == null) return null;
        return PolicyDocument.builder()
                .id(domain.getId())
                .name(domain.getName())
                .description(domain.getDescription())
                .version(domain.getVersion())
                .rules(domain.getRules())
                .createdBy(domain.getCreatedBy())
                .editors(domain.getEditors())
                .invitations(domain.getInvitations())
                .currentPublishedVersionId(domain.getCurrentPublishedVersionId())
                .status(domain.getStatus() == null ? "BORRADOR" : domain.getStatus())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    private Policy toDomain(PolicyDocument document) {
        if (document == null) return null;
        return Policy.builder()
                .id(document.getId())
                .name(document.getName())
                .description(document.getDescription())
                .version(document.getVersion())
                .rules(document.getRules())
                .createdBy(document.getCreatedBy())
                .editors(document.getEditors())
                .invitations(document.getInvitations())
                .currentPublishedVersionId(document.getCurrentPublishedVersionId())
                .status(document.getStatus())
                .createdAt(document.getCreatedAt())
                .updatedAt(document.getUpdatedAt())
                .build();
    }
}

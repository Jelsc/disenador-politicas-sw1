package com.tuapp.backend.policies.infrastructure;

import com.tuapp.backend.policies.domain.model.Policy;
import com.tuapp.backend.policies.domain.repository.PolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class PolicyRepositoryAdapter implements PolicyRepository {

    private final MongoPolicyRepository mongoRepository;

    @Override
    public Policy save(Policy policy) {
        return mongoRepository.save(policy);
    }

    @Override
    public Optional<Policy> findById(String id) {
        return mongoRepository.findById(id);
    }

    @Override
    public List<Policy> findAll() {
        return mongoRepository.findAll();
    }

    @Override
    public void deleteById(String id) {
        mongoRepository.deleteById(id);
    }
}

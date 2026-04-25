package com.tuapp.backend.policies.domain.repository;

import com.tuapp.backend.policies.domain.model.Policy;
import java.util.List;
import java.util.Optional;

public interface PolicyRepository {
    Policy save(Policy policy);
    Optional<Policy> findById(String id);
    List<Policy> findAll();
    void deleteById(String id);
}

package com.tuapp.backend.policies.domain;

import java.util.List;
import java.util.Optional;

public interface PolicyRepository {
    Policy save(Policy policy);
    Optional<Policy> findById(String id);
    List<Policy> findAll();
    void deleteById(String id);
}

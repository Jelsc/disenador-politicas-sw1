package com.tuapp.backend.policies.infrastructure;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PolicyChangeLogMongoRepository extends MongoRepository<PolicyChangeLogDocument, String> {
    List<PolicyChangeLogDocument> findTop100ByPolicyIdOrderByCreatedAtDesc(String policyId);
}

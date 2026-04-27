package com.tuapp.backend.policies.infrastructure;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PolicyAutosaveMongoRepository extends MongoRepository<PolicyAutosaveDocument, String> {
    Optional<PolicyAutosaveDocument> findByPolicyIdAndUsernameAndSessionId(String policyId, String username, String sessionId);
    Optional<PolicyAutosaveDocument> findTopByPolicyIdAndUsernameOrderBySavedAtDesc(String policyId, String username);
}

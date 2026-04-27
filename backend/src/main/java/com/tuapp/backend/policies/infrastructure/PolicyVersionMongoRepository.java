package com.tuapp.backend.policies.infrastructure;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PolicyVersionMongoRepository extends MongoRepository<PolicyVersionDocument, String> {
    long countByPolicyId(String policyId);
    List<PolicyVersionDocument> findByPolicyIdOrderByRevisionDesc(String policyId);
}

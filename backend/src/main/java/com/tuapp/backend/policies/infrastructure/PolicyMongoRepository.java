package com.tuapp.backend.policies.infrastructure;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PolicyMongoRepository extends MongoRepository<PolicyDocument, String> {
}

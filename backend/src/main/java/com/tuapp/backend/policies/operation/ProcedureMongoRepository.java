package com.tuapp.backend.policies.operation;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ProcedureMongoRepository extends MongoRepository<ProcedureDocument, String> {
    List<ProcedureDocument> findByCreatedByOrderByCreatedAtDesc(String createdBy);
    List<ProcedureDocument> findByClientCiOrderByCreatedAtDesc(String clientCi);
}

package com.tuapp.backend.policies.operation;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ProcedureNotificationMongoRepository extends MongoRepository<ProcedureNotificationDocument, String> {
    List<ProcedureNotificationDocument> findByRecipientUsernameOrderByCreatedAtDesc(String recipientUsername);
    long countByRecipientUsernameAndReadFalse(String recipientUsername);
}

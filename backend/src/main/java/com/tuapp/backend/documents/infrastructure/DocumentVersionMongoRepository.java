package com.tuapp.backend.documents.infrastructure;

import com.tuapp.backend.documents.domain.DocumentVersionDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentVersionMongoRepository extends MongoRepository<DocumentVersionDocument, String> {
    List<DocumentVersionDocument> findByProcedureIdOrderByCreatedAtDesc(String procedureId);
    List<DocumentVersionDocument> findByProcedureIdAndDocumentIdOrderByVersionAsc(String procedureId, String documentId);
    Optional<DocumentVersionDocument> findTopByProcedureIdAndDocumentIdOrderByVersionDesc(String procedureId, String documentId);
    Optional<DocumentVersionDocument> findByProcedureIdAndDocumentIdAndVersion(String procedureId, String documentId, Integer version);
}

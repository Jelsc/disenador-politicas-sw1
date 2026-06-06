package com.tuapp.backend.documents.infrastructure;

import com.tuapp.backend.documents.domain.DocumentRepositorySettingsDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface DocumentRepositorySettingsMongoRepository extends MongoRepository<DocumentRepositorySettingsDocument, String> {
}

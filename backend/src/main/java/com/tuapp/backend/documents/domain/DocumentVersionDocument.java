package com.tuapp.backend.documents.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "document_versions")
public class DocumentVersionDocument {
    @Id
    private String id;
    private String procedureId;
    private String policyId;
    private String documentId;
    private Integer version;
    private String originalFileName;
    private String storageKey;
    private String contentType;
    private Long size;
    private String createdBy;
    private String traceAction;
    private String traceNote;
    private LocalDateTime createdAt;
}

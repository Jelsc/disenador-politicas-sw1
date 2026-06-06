package com.tuapp.backend.documents.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "document_repository_settings")
public class DocumentRepositorySettingsDocument {
    @Id
    private String procedureId;
    private String policyId;
    private List<String> allowedRoles;
    private List<String> allowedFormats;
    private Long maxFileSizeMb;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

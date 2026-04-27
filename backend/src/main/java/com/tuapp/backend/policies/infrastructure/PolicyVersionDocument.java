package com.tuapp.backend.policies.infrastructure;

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
@Document(collection = "policy_versions")
public class PolicyVersionDocument {
    @Id
    private String id;
    private String policyId;
    private Integer revision;
    private Integer versionNumber;
    private String name;
    private String description;
    private String version;
    private String rules;
    private String diagramSnapshotJson;
    private String status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime publishedAt;
    private boolean published;
    private String changelogSummary;
}

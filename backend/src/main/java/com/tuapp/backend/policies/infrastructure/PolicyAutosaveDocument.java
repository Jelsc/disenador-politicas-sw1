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
@Document(collection = "policy_autosaves")
public class PolicyAutosaveDocument {
    @Id
    private String id;
    private String policyId;
    private String username;
    private String sessionId;
    private String diagramDraftJson;
    private String name;
    private String description;
    private LocalDateTime savedAt;
}

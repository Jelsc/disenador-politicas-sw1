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
@Document(collection = "policy_change_logs")
public class PolicyChangeLogDocument {
    @Id
    private String id;
    private String policyId;
    private String policyVersionId;
    private String username;
    private String actionType;
    private String targetType;
    private String targetId;
    private String beforeValue;
    private String afterValue;
    private LocalDateTime createdAt;
}

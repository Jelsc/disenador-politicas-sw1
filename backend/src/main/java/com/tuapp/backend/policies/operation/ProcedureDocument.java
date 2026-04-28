package com.tuapp.backend.policies.operation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "procedure_tickets")
public class ProcedureDocument {
    @Id
    private String id;
    private String policyId;
    private String policyName;
    private String status;
    private String createdBy;
    private String startDepartmentId;
    private String clientId;
    private String clientName;
    private String clientCi;
    private Map<String, Object> values;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
}

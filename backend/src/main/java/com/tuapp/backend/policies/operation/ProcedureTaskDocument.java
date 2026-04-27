package com.tuapp.backend.policies.operation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "procedure_tasks")
public class ProcedureTaskDocument {
    @Id
    private String id;
    private String procedureId;
    private String policyId;
    private String nodeId;
    private String nodeLabel;
    private String nodeType;
    private String taskType;
    private String departmentId;
    private String status; // PENDING, ASSIGNED, COMPLETED
    private String assignedTo;
    private String formTitle;
    private List<Map<String, Object>> formFields;
    private Map<String, Object> formValues;
    private LocalDateTime createdAt;
    private LocalDateTime assignedAt;
    private LocalDateTime completedAt;
}

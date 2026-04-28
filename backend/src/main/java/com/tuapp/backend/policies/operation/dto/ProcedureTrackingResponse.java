package com.tuapp.backend.policies.operation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcedureTrackingResponse {
    private String id;
    private String policyId;
    private String policyName;
    private String clientId;
    private String clientName;
    private String clientCi;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
    
    private int progressPercentage;
    private List<String> currentDepartments;
    private List<String> currentTasks;
    private String finalObservation;
}

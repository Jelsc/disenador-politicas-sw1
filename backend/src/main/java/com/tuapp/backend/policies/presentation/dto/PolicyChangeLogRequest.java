package com.tuapp.backend.policies.presentation.dto;

import lombok.Data;

@Data
public class PolicyChangeLogRequest {
    private String policyVersionId;
    private String actionType;
    private String targetType;
    private String targetId;
    private String beforeValue;
    private String afterValue;
}

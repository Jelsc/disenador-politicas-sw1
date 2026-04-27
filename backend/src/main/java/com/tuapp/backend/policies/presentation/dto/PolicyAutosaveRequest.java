package com.tuapp.backend.policies.presentation.dto;

import lombok.Data;

@Data
public class PolicyAutosaveRequest {
    private String sessionId;
    private String name;
    private String description;
    private String diagramDraftJson;
}

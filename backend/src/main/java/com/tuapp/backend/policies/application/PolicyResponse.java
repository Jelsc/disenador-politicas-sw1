package com.tuapp.backend.policies.application;

import com.tuapp.backend.policies.domain.model.PolicyStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PolicyResponse {
    private String id;
    private String name;
    private String description;
    private String rules;
    private PolicyStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

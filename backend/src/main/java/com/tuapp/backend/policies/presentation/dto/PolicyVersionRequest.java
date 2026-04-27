package com.tuapp.backend.policies.presentation.dto;

import lombok.Data;

@Data
public class PolicyVersionRequest {
    private String name;
    private String changelogSummary;
}

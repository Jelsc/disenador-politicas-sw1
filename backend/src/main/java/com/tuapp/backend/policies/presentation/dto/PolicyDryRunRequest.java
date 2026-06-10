package com.tuapp.backend.policies.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyDryRunRequest {
    private String policyName;

    @NotBlank(message = "Rules snapshot is required")
    private String rules;
}

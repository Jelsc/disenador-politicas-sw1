package com.tuapp.backend.policies.application;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyDryRunCheckResponse {
    private String label;
    private String status;
    private String detail;
}

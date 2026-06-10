package com.tuapp.backend.policies.application;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyDryRunReportResponse {
    private String policyName;
    private String status;
    private long durationMs;
    private int checkedPaths;
    private List<String> errors;
    private List<String> warnings;
    private List<String> bottlenecks;
    private List<PolicyDryRunCheckResponse> checks;
    private List<String> recommendations;
}

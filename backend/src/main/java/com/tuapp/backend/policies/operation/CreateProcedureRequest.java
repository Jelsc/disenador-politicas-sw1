package com.tuapp.backend.policies.operation;

import lombok.Data;

import java.util.Map;

@Data
public class CreateProcedureRequest {
    private String policyId;
    private String clientFullName;
    private String clientEmail;
    private String clientCi;
    private Map<String, Object> values;
}

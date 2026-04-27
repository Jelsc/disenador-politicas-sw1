package com.tuapp.backend.policies.operation;

import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
public class CompleteTaskRequest {
    private Map<String, Object> values = new HashMap<>();
}

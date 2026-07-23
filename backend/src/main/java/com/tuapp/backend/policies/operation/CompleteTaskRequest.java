package com.tuapp.backend.policies.operation;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
public class CompleteTaskRequest {
    @JsonAlias("formValues")
    private Map<String, Object> values = new HashMap<>();
}

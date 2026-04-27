package com.tuapp.backend.policies.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class PolicyRequest {
    @NotBlank(message = "Name is required")
    private String name;
    
    private String description;

    private String version;

    private String rules;

    private List<String> editors;
    
    private String status;
}

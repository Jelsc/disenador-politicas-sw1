package com.tuapp.backend.policies.application;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePolicyRequest {
    @NotBlank(message = "Name is required")
    private String name;
    
    @NotBlank(message = "Description is required")
    private String description;
    
    @NotBlank(message = "Rules JSON is required")
    private String rules;
}

package com.tuapp.backend.policies.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PolicyRequest {
    @NotBlank(message = "Name is required")
    private String name;
    
    @NotBlank(message = "Description is required")
    private String description;
    
    private String status;
}

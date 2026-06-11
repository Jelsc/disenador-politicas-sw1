package com.tuapp.backend.ai.client;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ClientConfirmTicketRequest {
    @NotBlank
    private String policyId;
}

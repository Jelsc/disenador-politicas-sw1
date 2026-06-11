package com.tuapp.backend.ai.client;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ClientAskRequest {
    private String text;
    private String audioBase64;
}

package com.tuapp.backend.documents.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record DocumentVersionPublishRequest(
        @NotBlank(message = "Version name is required") String versionName
) {
}

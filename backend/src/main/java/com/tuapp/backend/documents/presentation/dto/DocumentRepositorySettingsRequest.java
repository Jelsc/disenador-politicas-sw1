package com.tuapp.backend.documents.presentation.dto;

import java.util.List;

public record DocumentRepositorySettingsRequest(
        String policyId,
        List<String> allowedRoles,
        List<String> allowedFormats,
        Long maxFileSizeMb
) {
}

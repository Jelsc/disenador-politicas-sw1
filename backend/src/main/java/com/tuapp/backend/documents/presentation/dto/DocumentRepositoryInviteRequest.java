package com.tuapp.backend.documents.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record DocumentRepositoryInviteRequest(@NotBlank String username) {
}

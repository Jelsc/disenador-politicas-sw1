package com.tuapp.backend.documents.presentation.dto;

public record DocumentRepositoryUserResponse(
        String id,
        String username,
        String name,
        String email
) {
}

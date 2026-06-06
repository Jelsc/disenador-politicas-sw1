package com.tuapp.backend.documents.presentation.dto;

import java.time.LocalDateTime;

public record DocumentVersionResponse(
        String id,
        String procedureId,
        String policyId,
        String documentId,
        Integer version,
        String originalFileName,
        String storageKey,
        String contentType,
        Long size,
        String createdBy,
        String traceAction,
        String traceNote,
        LocalDateTime createdAt,
        String downloadUri
) {
}

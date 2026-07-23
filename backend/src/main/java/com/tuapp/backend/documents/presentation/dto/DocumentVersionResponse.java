package com.tuapp.backend.documents.presentation.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.tuapp.backend.documents.collaboration.DocumentPresenceParticipant;

public record DocumentVersionResponse(
        String id,
        String procedureId,
        String policyId,
        String documentId,
        Integer version,
        String versionName,
        String originalFileName,
        String storageKey,
        String contentType,
        Long size,
        String createdBy,
        String traceAction,
        String traceNote,
        LocalDateTime createdAt,
        String downloadUri,
        boolean onlyOfficeSupported,
        String onlyOfficeEditorUrl,
        List<DocumentPresenceParticipant> activeEditors
) {
}

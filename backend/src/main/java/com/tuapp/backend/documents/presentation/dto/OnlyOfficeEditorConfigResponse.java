package com.tuapp.backend.documents.presentation.dto;

import java.util.Map;

public record OnlyOfficeEditorConfigResponse(
        String documentServerUrl,
        Map<String, Object> config
) {
}

package com.tuapp.backend.documents.application;

import org.springframework.core.io.Resource;

public record OnlyOfficeDownloadResponse(
        Resource resource,
        String contentType,
        String fileName
) {
}

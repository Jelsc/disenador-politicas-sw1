package com.tuapp.backend.documents.presentation.dto;

import java.util.List;

public record OnlyOfficeCallbackRequest(
        String key,
        Integer status,
        String url,
        List<String> users
) {
}

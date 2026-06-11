package com.tuapp.backend.ai.reports;

import lombok.Data;

@Data
public class PdfDownloadRequest {
    private String draftTitle;
    private String draftBody;
}

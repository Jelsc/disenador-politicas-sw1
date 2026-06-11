package com.tuapp.backend.ai.reports;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai/reports")
@RequiredArgsConstructor
public class AiReportController {

    private final PdfGeneratorService pdfGeneratorService;

    @PostMapping("/download-pdf")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR', 'DESIGNER', 'AUDITOR')")
    public ResponseEntity<byte[]> downloadPdfReport(@RequestBody PdfDownloadRequest request) {
        if (request.getDraftTitle() == null || request.getDraftTitle().trim().isEmpty()) {
            request.setDraftTitle("Reporte sin título");
        }
        
        byte[] pdfBytes = pdfGeneratorService.generateAiReportPdf(request.getDraftTitle(), request.getDraftBody());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        // Sugerir nombre de archivo
        String filename = request.getDraftTitle().replaceAll("[^a-zA-Z0-9.-]", "_") + ".pdf";
        headers.setContentDispositionFormData("attachment", filename);

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }
}

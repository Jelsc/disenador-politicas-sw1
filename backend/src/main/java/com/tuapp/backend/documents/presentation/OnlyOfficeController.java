package com.tuapp.backend.documents.presentation;

import com.tuapp.backend.documents.application.DocumentRepositoryService;
import com.tuapp.backend.documents.application.OnlyOfficeDownloadResponse;
import com.tuapp.backend.documents.presentation.dto.OnlyOfficeCallbackRequest;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/onlyoffice")
public class OnlyOfficeController {

    private final DocumentRepositoryService service;

    public OnlyOfficeController(DocumentRepositoryService service) {
        this.service = service;
    }

    @GetMapping("/documents/{token}")
    public ResponseEntity<Resource> download(@PathVariable String token) {
        try {
            OnlyOfficeDownloadResponse response = service.downloadOnlyOfficeDocument(token);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(response.contentType()))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + response.fileName() + "\"")
                    .body(response.resource());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @PostMapping("/callback/{token}")
    public ResponseEntity<Map<String, Integer>> callback(@PathVariable String token,
                                                         @RequestBody(required = false) OnlyOfficeCallbackRequest request) {
        try {
            service.handleOnlyOfficeCallback(token, request);
            return ResponseEntity.ok(Map.of("error", 0));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", 1));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", 1));
        }
    }
}

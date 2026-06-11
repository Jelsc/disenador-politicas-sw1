package com.tuapp.backend.shared.infrastructure.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileStorageServiceTest {

    private InMemoryGateway gateway;
    private FileStorageService service;

    @BeforeEach
    void setUp() {
        gateway = new InMemoryGateway();
        service = new FileStorageService(gateway, "application/octet-stream");
    }

    @Test
    void storesAndLoadsFileThroughGateway() throws IOException {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "policy.pdf",
                "application/pdf",
                "pdf-content".getBytes(StandardCharsets.UTF_8)
        );

        String fileName = service.storeFile(file, List.of("pdf"), 2L);

        assertThat(fileName).endsWith(".pdf");
        Resource resource = service.loadFileAsResource(fileName);
        assertThat(resource.getFilename()).isEqualTo(fileName);
        assertThat(resource.getInputStream().readAllBytes()).isEqualTo("pdf-content".getBytes(StandardCharsets.UTF_8));
        assertThat(service.getContentType(fileName)).contains("application/pdf");
    }

    @Test
    void rejectsDisallowedFormatsBeforeStorage() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "policy.exe",
                "application/octet-stream",
                "bin".getBytes(StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> service.storeFile(file, List.of("pdf", "docx"), 2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Formato no permitido");
    }

    @Test
    void rejectsOversizedFilesBeforeStorage() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "policy.pdf",
                "application/pdf",
                new byte[1024 * 1024 + 1]
        );

        assertThatThrownBy(() -> service.storeFile(file, List.of("pdf"), 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("supera el tamaño máximo permitido");
    }

    private static final class InMemoryGateway implements FileObjectGateway {
        private final Map<String, byte[]> contentByKey = new HashMap<>();
        private final Map<String, String> contentTypeByKey = new HashMap<>();

        @Override
        public void put(String key, byte[] content, String contentType) {
            contentByKey.put(key, content);
            contentTypeByKey.put(key, contentType);
        }

        @Override
        public byte[] get(String key) {
            return contentByKey.get(key);
        }

        @Override
        public java.util.Optional<String> contentType(String key) {
            return java.util.Optional.ofNullable(contentTypeByKey.get(key));
        }

        @Override
        public void delete(String key) {
            contentByKey.remove(key);
            contentTypeByKey.remove(key);
        }
    }
}

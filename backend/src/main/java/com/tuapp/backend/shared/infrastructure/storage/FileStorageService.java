package com.tuapp.backend.shared.infrastructure.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class FileStorageService {

    private final FileObjectGateway fileObjectGateway;
    private final String contentTypeFallback;

    public FileStorageService(FileObjectGateway fileObjectGateway,
                              @Value("${spring.servlet.multipart.default-content-type:application/octet-stream}") String contentTypeFallback) {
        this.fileObjectGateway = fileObjectGateway;
        this.contentTypeFallback = contentTypeFallback;
    }

    public String storeFile(MultipartFile file) {
        return storeFile(file, List.of(), null);
    }

    public String storeFile(MultipartFile file, List<String> allowedFormats, Long maxFileSizeMb) {
        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "file");
        String fileExtension = "";
        
        int lastDotIndex = originalFileName.lastIndexOf(".");
        if (lastDotIndex > 0) {
            fileExtension = originalFileName.substring(lastDotIndex);
        }

        if (maxFileSizeMb != null && maxFileSizeMb > 0) {
            long maxBytes = maxFileSizeMb * 1024L * 1024L;
            if (file.getSize() > maxBytes) {
                throw new IllegalArgumentException("El archivo supera el tamaño máximo permitido de " + maxFileSizeMb + " MB.");
            }
        }

        if (allowedFormats != null && !allowedFormats.isEmpty()) {
            String normalizedExtension = fileExtension.replace(".", "").toLowerCase(Locale.ROOT);
            boolean allowed = allowedFormats.stream()
                    .filter(format -> format != null && !format.isBlank())
                    .map(format -> format.replace(".", "").trim().toLowerCase(Locale.ROOT))
                    .anyMatch(format -> format.equals(normalizedExtension));
            if (!allowed) {
                throw new IllegalArgumentException("Formato no permitido. Permitidos: " + String.join(", ", allowedFormats));
            }
        }

        String fileName = UUID.randomUUID().toString() + fileExtension;

        try {
            fileObjectGateway.put(fileName, file.getBytes(), resolveContentType(file, fileName));
            return fileName;
        } catch (IOException ex) {
            throw new RuntimeException("Could not store file " + fileName + ". Please try again!", ex);
        }
    }

    public Resource loadFileAsResource(String fileName) {
        byte[] content = fileObjectGateway.get(fileName);
        return new ByteArrayResource(content) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };
    }

    public Optional<String> getContentType(String fileName) {
        return fileObjectGateway.contentType(fileName)
                .filter(type -> !type.isBlank())
                .or(() -> Optional.ofNullable(contentTypeFallback));
    }

    private String resolveContentType(MultipartFile file, String fileName) {
        if (file.getContentType() != null && !file.getContentType().isBlank()) {
            return file.getContentType();
        }
        return contentTypeFallback;
    }
}

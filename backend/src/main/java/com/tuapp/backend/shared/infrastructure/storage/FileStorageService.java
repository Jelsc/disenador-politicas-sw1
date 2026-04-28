package com.tuapp.backend.shared.infrastructure.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import java.util.List;
import java.util.Locale;

@Service
public class FileStorageService {

    private final Path fileStorageLocation;

    public FileStorageService(@Value("${FILE_STORAGE_PATH:./uploads}") String storagePath) {
        this.fileStorageLocation = Paths.get(storagePath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new RuntimeException("Could not create the directory where the uploaded files will be stored.", ex);
        }
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
            if (fileName.contains("..")) {
                throw new RuntimeException("Filename contains invalid path sequence " + fileName);
            }

            Path targetLocation = this.fileStorageLocation.resolve(fileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            return fileName;
        } catch (IOException ex) {
            throw new RuntimeException("Could not store file " + fileName + ". Please try again!", ex);
        }
    }

    public Resource loadFileAsResource(String fileName) {
        try {
            Path filePath = this.fileStorageLocation.resolve(fileName).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            } else {
                throw new RuntimeException("File not found " + fileName);
            }
        } catch (MalformedURLException ex) {
            throw new RuntimeException("File not found " + fileName, ex);
        }
    }
}

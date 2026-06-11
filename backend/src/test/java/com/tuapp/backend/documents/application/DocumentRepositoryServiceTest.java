package com.tuapp.backend.documents.application;

import com.tuapp.backend.documents.domain.DocumentRepositorySettingsDocument;
import com.tuapp.backend.documents.domain.DocumentVersionDocument;
import com.tuapp.backend.documents.infrastructure.DocumentRepositorySettingsMongoRepository;
import com.tuapp.backend.documents.infrastructure.DocumentVersionMongoRepository;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositorySettingsRequest;
import com.tuapp.backend.shared.infrastructure.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;

class DocumentRepositoryServiceTest {

    private FileStorageService fileStorageService;
    private DocumentRepositorySettingsMongoRepository settingsRepository;
    private DocumentVersionMongoRepository versionRepository;
    private UserRepository userRepository;
    private DocumentRepositoryService service;

    @BeforeEach
    void setUp() {
        fileStorageService = mock(FileStorageService.class);
        settingsRepository = mock(DocumentRepositorySettingsMongoRepository.class);
        versionRepository = mock(DocumentVersionMongoRepository.class);
        userRepository = mock(UserRepository.class);
        service = new DocumentRepositoryService(fileStorageService, settingsRepository, versionRepository, userRepository);
    }

    @Test
    void uploadsNewDocumentAndCreatesNewVersion() {
        when(settingsRepository.findById("proc-1")).thenReturn(Optional.of(DocumentRepositorySettingsDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .allowedRoles(List.of("DESIGNER", "OPERATOR"))
                .allowedFormats(List.of("pdf", "docx"))
                .maxFileSizeMb(5L)
                .createdAt(LocalDateTime.now())
                .build()));
        when(versionRepository.findTopByProcedureIdAndDocumentIdOrderByVersionDesc("proc-1", "doc-1")).thenReturn(Optional.empty());
        when(fileStorageService.storeFile(any(), any(), any())).thenReturn("storage-key-1.pdf");
        when(versionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        
        User mockUser = new User();
        mockUser.setUsername("ana");
        mockUser.setDepartmentIds(List.of("OPERATOR"));
        when(userRepository.findByUsername("ana")).thenReturn(Optional.of(mockUser));

        MockMultipartFile file = new MockMultipartFile("file", "evidence.pdf", "application/pdf", "content".getBytes(StandardCharsets.UTF_8));
        DocumentVersionDocument saved = service.uploadDocument("proc-1", file, "doc-1", "DESIGNER", "ana", false);

        assertThat(saved.getVersion()).isEqualTo(1);
        assertThat(saved.getTraceAction()).isEqualTo("UPLOAD");
        assertThat(saved.getPolicyId()).isEqualTo("policy-1");
    }

    @Test
    void incrementsVersionForExistingDocument() {
        when(settingsRepository.findById("proc-1")).thenReturn(Optional.of(DocumentRepositorySettingsDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .allowedRoles(List.of("DESIGNER"))
                .allowedFormats(List.of("pdf"))
                .maxFileSizeMb(5L)
                .createdAt(LocalDateTime.now())
                .build()));
        when(versionRepository.findTopByProcedureIdAndDocumentIdOrderByVersionDesc("proc-1", "doc-1")).thenReturn(Optional.of(DocumentVersionDocument.builder().version(1).build()));
        when(fileStorageService.storeFile(any(), any(), any())).thenReturn("storage-key-2.pdf");
        when(versionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        
        User mockUser = new User();
        mockUser.setUsername("ana");
        mockUser.setDepartmentIds(List.of("DESIGNER"));
        when(userRepository.findByUsername("ana")).thenReturn(Optional.of(mockUser));

        MockMultipartFile file = new MockMultipartFile("file", "evidence.pdf", "application/pdf", "content".getBytes(StandardCharsets.UTF_8));
        DocumentVersionDocument saved = service.uploadDocument("proc-1", file, "doc-1", "DESIGNER", "ana", false);

        assertThat(saved.getVersion()).isEqualTo(2);
        assertThat(saved.getTraceAction()).isEqualTo("NEW_VERSION");
    }

    @Test
    void rejectsRoleWithoutWritePermission() {
        when(settingsRepository.findById("proc-1")).thenReturn(Optional.of(DocumentRepositorySettingsDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .allowedRoles(List.of("DESIGNER"))
                .allowedFormats(List.of("pdf"))
                .maxFileSizeMb(5L)
                .createdAt(LocalDateTime.now())
                .build()));

        MockMultipartFile file = new MockMultipartFile("file", "evidence.pdf", "application/pdf", "content".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> service.uploadDocument("proc-1", file, "doc-1", "OPERATOR", "juan", false))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
}

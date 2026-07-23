package com.tuapp.backend.documents.application;

import com.tuapp.backend.documents.collaboration.DocumentPresenceParticipant;
import com.tuapp.backend.documents.collaboration.DocumentPresenceRegistry;
import com.tuapp.backend.documents.domain.DocumentRepositorySettingsDocument;
import com.tuapp.backend.documents.domain.DocumentVersionDocument;
import com.tuapp.backend.documents.infrastructure.DocumentRepositorySettingsMongoRepository;
import com.tuapp.backend.documents.infrastructure.DocumentVersionMongoRepository;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositoryInviteRequest;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositoryUserResponse;
import com.tuapp.backend.documents.presentation.dto.DocumentRepositorySettingsRequest;
import com.tuapp.backend.shared.infrastructure.storage.FileStorageService;
import com.tuapp.backend.policies.operation.ProcedureMongoRepository;
import com.tuapp.backend.policies.operation.ProcedureDocument;
import com.tuapp.backend.policies.operation.ProcedureTaskMongoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
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
    private DocumentPresenceRegistry presenceRegistry;
    private ProcedureMongoRepository procedureRepository;
    private ProcedureTaskMongoRepository taskRepository;
    private DocumentRepositoryService service;

    @BeforeEach
    void setUp() {
        fileStorageService = mock(FileStorageService.class);
        settingsRepository = mock(DocumentRepositorySettingsMongoRepository.class);
        versionRepository = mock(DocumentVersionMongoRepository.class);
        userRepository = mock(UserRepository.class);
        procedureRepository = mock(ProcedureMongoRepository.class);
        taskRepository = mock(ProcedureTaskMongoRepository.class);
        presenceRegistry = new DocumentPresenceRegistry();
        service = new DocumentRepositoryService(fileStorageService, settingsRepository, versionRepository, userRepository, presenceRegistry, procedureRepository, taskRepository);
        when(procedureRepository.findById(org.mockito.ArgumentMatchers.any())).thenReturn(Optional.empty());
        when(taskRepository.findByProcedureIdOrderByCreatedAtAsc(org.mockito.ArgumentMatchers.any())).thenReturn(List.of());
        ReflectionTestUtils.setField(service, "onlyOfficeEnabled", true);
        ReflectionTestUtils.setField(service, "onlyOfficeDocumentServerUrl", "https://onlyoffice.example/");
        ReflectionTestUtils.setField(service, "onlyOfficeSharedSecret", "shared-secret");
        ReflectionTestUtils.setField(service, "frontendBaseUrl", "https://frontend.example/");
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

    @Test
    void allowsInvitedUsersToReadProcedureRepositoriesAndManageInvites() {
        when(settingsRepository.findById("proc-1")).thenReturn(Optional.of(DocumentRepositorySettingsDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .allowedRoles(List.of("DESIGNER"))
                .allowedFormats(List.of("pdf"))
                .maxFileSizeMb(5L)
                .createdAt(LocalDateTime.now())
                .build()));
        when(procedureRepository.findById("proc-1")).thenReturn(Optional.of(ProcedureDocument.builder()
                .id("proc-1")
                .createdBy("ana")
                .invitedUsers(List.of("luis"))
                .build()));
        when(taskRepository.findByProcedureIdOrderByCreatedAtAsc("proc-1")).thenReturn(List.of());
        when(versionRepository.findByProcedureIdOrderByCreatedAtDesc("proc-1")).thenReturn(List.of());
        when(procedureRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findByUsername("luis")).thenReturn(Optional.of(user("u-2", "luis", "luis@example.com", "Luis Pérez")));
        when(userRepository.findByUsername("maria")).thenReturn(Optional.of(user("u-3", "maria", "maria@example.com", "María Torres")));

        DocumentVersionDocument invitedView = service.listLatestDocuments("proc-1", "OPERATOR", "luis", false).stream().findFirst().orElse(null);
        assertThat(invitedView).isNull();

        var invited = service.inviteUser("proc-1", new DocumentRepositoryInviteRequest("maria"), "DESIGNER", "ana", false);
        assertThat(invited).extracting(DocumentRepositoryUserResponse::username).containsExactly("luis", "maria");

        var revoked = service.revokeUser("proc-1", "maria", "DESIGNER", "ana", false);
        assertThat(revoked).extracting(DocumentRepositoryUserResponse::username).containsExactly("luis");
    }

    @Test
    void listsCurrentProcedureParticipantsFromAssignedTasks() {
        when(procedureRepository.findById("proc-1")).thenReturn(Optional.of(ProcedureDocument.builder()
                .id("proc-1")
                .createdBy("ana")
                .invitedUsers(List.of("luis"))
                .build()));
        when(taskRepository.findByProcedureIdOrderByCreatedAtAsc("proc-1")).thenReturn(List.of(
                com.tuapp.backend.policies.operation.ProcedureTaskDocument.builder().assignedTo("luis").build(),
                com.tuapp.backend.policies.operation.ProcedureTaskDocument.builder().assignedTo("maria").build(),
                com.tuapp.backend.policies.operation.ProcedureTaskDocument.builder().assignedTo("").build()
        ));
        when(userRepository.findByUsername("luis")).thenReturn(Optional.of(user("u-2", "luis", "luis@example.com", "Luis Pérez")));
        when(userRepository.findByUsername("maria")).thenReturn(Optional.of(user("u-3", "maria", "maria@example.com", "María Torres")));

        var participants = service.listProcedureParticipants("proc-1", "DESIGNER", "ana", false);

        assertThat(participants).extracting(DocumentRepositoryUserResponse::username).containsExactly("luis", "maria");
    }

    @ParameterizedTest
    @CsvSource({
            "report.docx,word,docx",
            "report.xlsx,cell,xlsx",
            "report.csv,cell,csv",
            "slides.pptx,slide,pptx"
    })
    void exposesOnlyOfficeForEditableFormats(String originalFileName, String expectedDocumentType, String expectedFileType) {
        when(settingsRepository.findById("proc-1")).thenReturn(Optional.of(DocumentRepositorySettingsDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .allowedRoles(List.of("DESIGNER"))
                .allowedFormats(List.of("pdf", "docx", "xlsx", "csv", "pptx"))
                .maxFileSizeMb(5L)
                .createdAt(LocalDateTime.now())
                .build()));
        when(versionRepository.findByProcedureIdAndDocumentIdAndVersion("proc-1", "doc-1", 1)).thenReturn(Optional.of(DocumentVersionDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .documentId("doc-1")
                .version(1)
                .originalFileName(originalFileName)
                .storageKey("storage-key")
                .contentType("application/octet-stream")
                .size(1L)
                .createdBy("ana")
                .traceAction("UPLOAD")
                .traceNote("Uploaded")
                .createdAt(LocalDateTime.now())
                .build()));

        DocumentVersionDocument document = DocumentVersionDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .documentId("doc-1")
                .version(1)
                .originalFileName(originalFileName)
                .storageKey("storage-key")
                .contentType("application/octet-stream")
                .size(1L)
                .createdBy("ana")
                .traceAction("UPLOAD")
                .traceNote("Uploaded")
                .createdAt(LocalDateTime.now())
                .build();

        presenceRegistry.update("proc-1::doc-1", List.of(new DocumentPresenceParticipant("ana", "Ana López", "ana@example.com")));

        var response = service.toResponse("proc-1", document, "DESIGNER", "ana", true);
        assertThat(response.onlyOfficeSupported()).isTrue();
        assertThat(response.onlyOfficeEditorUrl()).contains("/documents/proc-1/doc-1/versions/1/editor");
        assertThat(response.activeEditors()).hasSize(1);
        assertThat(response.activeEditors().get(0).name()).isEqualTo("Ana López");

        var configResponse = service.buildOnlyOfficeEditorConfig("http://backend.local", "proc-1", "doc-1", 1, "DESIGNER", "ana", true);
        Map<String, Object> config = configResponse.config();
        Map<String, Object> documentConfig = (Map<String, Object>) config.get("document");

        assertThat(configResponse.documentServerUrl()).isEqualTo("https://onlyoffice.example");
        assertThat(config.get("documentType")).isEqualTo(expectedDocumentType);
        assertThat(documentConfig.get("fileType")).isEqualTo(expectedFileType);
        assertThat(documentConfig.get("title")).isEqualTo(originalFileName);
    }

    @Test
    void infersOnlyOfficeSupportFromSpreadsheetContentTypeWhenFilenameHasNoExtension() {
        when(settingsRepository.findById("proc-1")).thenReturn(Optional.of(DocumentRepositorySettingsDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .allowedRoles(List.of("DESIGNER"))
                .allowedFormats(List.of("pdf", "docx", "xlsx", "csv", "pptx"))
                .maxFileSizeMb(5L)
                .createdAt(LocalDateTime.now())
                .build()));
        when(versionRepository.findByProcedureIdAndDocumentIdAndVersion("proc-1", "doc-1", 1)).thenReturn(Optional.of(DocumentVersionDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .documentId("doc-1")
                .version(1)
                .originalFileName("sheet")
                .storageKey("storage-key")
                .contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .size(1L)
                .createdBy("ana")
                .traceAction("UPLOAD")
                .traceNote("Uploaded")
                .createdAt(LocalDateTime.now())
                .build()));

        DocumentVersionDocument document = DocumentVersionDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .documentId("doc-1")
                .version(1)
                .originalFileName("sheet")
                .storageKey("storage-key")
                .contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .size(1L)
                .createdBy("ana")
                .traceAction("UPLOAD")
                .traceNote("Uploaded")
                .createdAt(LocalDateTime.now())
                .build();

        var response = service.toResponse("proc-1", document, "DESIGNER", "ana", true);
        assertThat(response.onlyOfficeSupported()).isTrue();

        var configResponse = service.buildOnlyOfficeEditorConfig("http://backend.local", "proc-1", "doc-1", 1, "DESIGNER", "ana", true);
        Map<String, Object> config = configResponse.config();
        Map<String, Object> documentConfig = (Map<String, Object>) config.get("document");

        assertThat(config.get("documentType")).isEqualTo("cell");
        assertThat(documentConfig.get("fileType")).isEqualTo("xlsx");
    }

    @Test
    void infersOnlyOfficeSupportFromPresentationContentTypeWhenFilenameHasNoExtension() {
        when(settingsRepository.findById("proc-1")).thenReturn(Optional.of(DocumentRepositorySettingsDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .allowedRoles(List.of("DESIGNER"))
                .allowedFormats(List.of("pdf", "docx", "xlsx", "csv", "pptx"))
                .maxFileSizeMb(5L)
                .createdAt(LocalDateTime.now())
                .build()));
        when(versionRepository.findByProcedureIdAndDocumentIdAndVersion("proc-1", "doc-2", 1)).thenReturn(Optional.of(DocumentVersionDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .documentId("doc-2")
                .version(1)
                .originalFileName("slides")
                .storageKey("storage-key.pptx")
                .contentType("application/vnd.openxmlformats-officedocument.presentationml.presentation")
                .size(1L)
                .createdBy("ana")
                .traceAction("UPLOAD")
                .traceNote("Uploaded")
                .createdAt(LocalDateTime.now())
                .build()));

        DocumentVersionDocument document = DocumentVersionDocument.builder()
                .procedureId("proc-1")
                .policyId("policy-1")
                .documentId("doc-2")
                .version(1)
                .originalFileName("slides")
                .storageKey("storage-key.pptx")
                .contentType("application/vnd.openxmlformats-officedocument.presentationml.presentation")
                .size(1L)
                .createdBy("ana")
                .traceAction("UPLOAD")
                .traceNote("Uploaded")
                .createdAt(LocalDateTime.now())
                .build();

        var response = service.toResponse("proc-1", document, "DESIGNER", "ana", true);
        assertThat(response.onlyOfficeSupported()).isTrue();

        var configResponse = service.buildOnlyOfficeEditorConfig("http://backend.local", "proc-1", "doc-2", 1, "DESIGNER", "ana", true);
        Map<String, Object> config = configResponse.config();
        Map<String, Object> documentConfig = (Map<String, Object>) config.get("document");

        assertThat(config.get("documentType")).isEqualTo("slide");
        assertThat(documentConfig.get("fileType")).isEqualTo("pptx");
    }

    private User user(String id, String username, String email, String name) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        user.setName(name);
        return user;
    }
}

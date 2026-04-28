package com.tuapp.backend.policies.operation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "client_notifications")
public class ProcedureNotificationDocument {
    @Id
    private String id;
    private String recipientUsername;
    private String title;
    private String body;
    private String type;
    private String procedureId;
    private String taskId;
    private String fieldId;
    private Map<String, String> data;
    private boolean read;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
}

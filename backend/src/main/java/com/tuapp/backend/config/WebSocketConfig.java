package com.tuapp.backend.config;

import com.tuapp.backend.documents.collaboration.DocumentCollaborationWebSocketHandler;
import com.tuapp.backend.policies.collaboration.PolicyBoardWebSocketHandler;
import com.tuapp.backend.policies.collaboration.PolicyNotificationWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.beans.factory.annotation.Value;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Value("${ALLOWED_ORIGINS:http://localhost:4200,http://localhost:80,http://localhost}")
    private String[] allowedOrigins;

    private final PolicyBoardWebSocketHandler boardHandler;
    private final PolicyNotificationWebSocketHandler notificationHandler;
    private final DocumentCollaborationWebSocketHandler documentCollaborationHandler;

    public WebSocketConfig(PolicyBoardWebSocketHandler boardHandler,
                           PolicyNotificationWebSocketHandler notificationHandler,
                           DocumentCollaborationWebSocketHandler documentCollaborationHandler) {
        this.boardHandler = boardHandler;
        this.notificationHandler = notificationHandler;
        this.documentCollaborationHandler = documentCollaborationHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(boardHandler, "/ws/policies/{policyId}")
                .setAllowedOrigins(allowedOrigins);
        registry.addHandler(notificationHandler, "/ws/notifications/{username}")
                .setAllowedOrigins(allowedOrigins);
        registry.addHandler(documentCollaborationHandler, "/ws/documents/{procedureId}/{documentId}")
                .setAllowedOrigins(allowedOrigins);
    }
}

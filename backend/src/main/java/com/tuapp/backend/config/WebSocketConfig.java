package com.tuapp.backend.config;

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

    @Value("${ALLOWED_ORIGINS:http://localhost:4200}")
    private String[] allowedOrigins;

    private final PolicyBoardWebSocketHandler boardHandler;
    private final PolicyNotificationWebSocketHandler notificationHandler;

    public WebSocketConfig(PolicyBoardWebSocketHandler boardHandler, PolicyNotificationWebSocketHandler notificationHandler) {
        this.boardHandler = boardHandler;
        this.notificationHandler = notificationHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(boardHandler, "/ws/policies/{policyId}")
                .setAllowedOrigins(allowedOrigins);
        registry.addHandler(notificationHandler, "/ws/notifications/{username}")
                .setAllowedOrigins(allowedOrigins);
    }
}


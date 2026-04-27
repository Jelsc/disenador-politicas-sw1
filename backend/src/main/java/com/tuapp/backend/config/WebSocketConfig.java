package com.tuapp.backend.config;

import com.tuapp.backend.policies.collaboration.PolicyBoardWebSocketHandler;
import com.tuapp.backend.policies.collaboration.PolicyNotificationWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    private final PolicyBoardWebSocketHandler policyBoardWebSocketHandler;
    private final PolicyNotificationWebSocketHandler policyNotificationWebSocketHandler;

    public WebSocketConfig(PolicyBoardWebSocketHandler policyBoardWebSocketHandler,
                           PolicyNotificationWebSocketHandler policyNotificationWebSocketHandler) {
        this.policyBoardWebSocketHandler = policyBoardWebSocketHandler;
        this.policyNotificationWebSocketHandler = policyNotificationWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(policyBoardWebSocketHandler, "/ws/policies/*")
                .setAllowedOrigins("http://localhost:4200");
        registry.addHandler(policyNotificationWebSocketHandler, "/ws/notifications/*")
                .setAllowedOrigins("http://localhost:4200");
    }
}

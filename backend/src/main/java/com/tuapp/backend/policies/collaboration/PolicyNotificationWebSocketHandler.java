package com.tuapp.backend.policies.collaboration;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PolicyNotificationWebSocketHandler extends TextWebSocketHandler {
    private final Map<String, Set<WebSocketSession>> sessionsByUsername = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessionsByUsername.computeIfAbsent(resolveUsername(session), key -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = resolveUsername(session);
        Set<WebSocketSession> sessions = sessionsByUsername.get(username);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) sessionsByUsername.remove(username);
        }
    }

    public void notifyUser(String username, String payload) {
        for (WebSocketSession session : sessionsByUsername.getOrDefault(username, Set.of())) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(payload));
                } catch (IOException ignored) {
                }
            }
        }
    }

    private String resolveUsername(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null) return "unknown";
        String[] parts = uri.getPath().split("/");
        return parts.length == 0 ? "unknown" : parts[parts.length - 1];
    }
}

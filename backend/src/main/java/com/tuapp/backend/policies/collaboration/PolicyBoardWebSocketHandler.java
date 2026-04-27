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
public class PolicyBoardWebSocketHandler extends TextWebSocketHandler {
    private final Map<String, Set<WebSocketSession>> sessionsByPolicy = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessionsByPolicy.computeIfAbsent(resolvePolicyId(session), key -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String policyId = resolvePolicyId(session);
        for (WebSocketSession peer : sessionsByPolicy.getOrDefault(policyId, Set.of())) {
            if (peer.isOpen() && !peer.getId().equals(session.getId())) {
                peer.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String policyId = resolvePolicyId(session);
        Set<WebSocketSession> sessions = sessionsByPolicy.get(policyId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) sessionsByPolicy.remove(policyId);
        }
    }

    private String resolvePolicyId(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null) return "unknown";
        String[] parts = uri.getPath().split("/");
        return parts.length == 0 ? "unknown" : parts[parts.length - 1];
    }
}

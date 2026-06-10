package com.tuapp.backend.documents.collaboration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class DocumentCollaborationWebSocketHandler extends TextWebSocketHandler {
    private static final String SNAPSHOT_TYPE = "DOCUMENT_PRESENCE_STATE";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, Set<WebSocketSession>> sessionsByDocument = new ConcurrentHashMap<>();
    private final Map<String, String> usernameBySessionId = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String documentKey = resolveDocumentKey(session);
        sessionsByDocument.computeIfAbsent(documentKey, key -> ConcurrentHashMap.newKeySet()).add(session);
        usernameBySessionId.put(session.getId(), resolveUsername(session));
        broadcastSnapshot(documentKey);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String documentKey = resolveDocumentKey(session);
        Set<WebSocketSession> sessions = sessionsByDocument.get(documentKey);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                sessionsByDocument.remove(documentKey);
            }
        }
        usernameBySessionId.remove(session.getId());
        broadcastSnapshot(documentKey);
    }

    private void broadcastSnapshot(String documentKey) {
        Set<WebSocketSession> sessions = sessionsByDocument.get(documentKey);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        List<String> viewers = sessions.stream()
                .map(session -> usernameBySessionId.getOrDefault(session.getId(), resolveUsername(session)))
                .filter(username -> username != null && !username.isBlank())
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();

        DocumentPresenceSnapshot snapshot = new DocumentPresenceSnapshot(
                SNAPSHOT_TYPE,
                resolveProcedureId(documentKey),
                resolveDocumentId(documentKey),
                viewers.size(),
                viewers,
                System.currentTimeMillis()
        );

        try {
            String payload = objectMapper.writeValueAsString(snapshot);
            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(new TextMessage(payload));
                    } catch (IOException ignored) {
                    }
                }
            }
        } catch (JsonProcessingException ignored) {
        }
    }

    private String resolveDocumentKey(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null) {
            return "unknown::unknown";
        }

        String[] parts = uri.getPath().split("/");
        if (parts.length < 5) {
            return "unknown::unknown";
        }

        return parts[parts.length - 2] + "::" + parts[parts.length - 1];
    }

    private String resolveProcedureId(String documentKey) {
        return documentKey.contains("::") ? documentKey.split("::", 2)[0] : "unknown";
    }

    private String resolveDocumentId(String documentKey) {
        return documentKey.contains("::") ? documentKey.split("::", 2)[1] : "unknown";
    }

    private String resolveUsername(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null || uri.getQuery() == null || uri.getQuery().isBlank()) {
            return "anonymous";
        }

        for (String pair : uri.getQuery().split("&")) {
            String[] keyValue = pair.split("=", 2);
            if (keyValue.length == 2 && "username".equals(keyValue[0])) {
                String decoded = URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8);
                return decoded.isBlank() ? "anonymous" : decoded;
            }
        }

        return "anonymous";
    }

    private record DocumentPresenceSnapshot(
            String type,
            String procedureId,
            String documentId,
            int observersCount,
            List<String> viewers,
            long timestamp
    ) {
    }
}

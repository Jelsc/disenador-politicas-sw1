package com.tuapp.backend.documents.collaboration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DocumentCollaborationWebSocketHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private DocumentCollaborationWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        handler = new DocumentCollaborationWebSocketHandler();
    }

    @Test
    void broadcastsObserverCountPerDocumentOnJoin() throws Exception {
        WebSocketSession ana = session("ana", "ws://localhost/ws/documents/proc-1/doc-1?username=ana");
        WebSocketSession luis = session("luis", "ws://localhost/ws/documents/proc-1/doc-1?username=luis");
        WebSocketSession other = session("sofia", "ws://localhost/ws/documents/proc-1/doc-2?username=sofia");

        handler.afterConnectionEstablished(ana);
        handler.afterConnectionEstablished(luis);
        handler.afterConnectionEstablished(other);

        JsonNode payload = payloadFrom(ana);
        JsonNode otherPayload = payloadFrom(other);

        assertThat(payload.path("type").asText()).isEqualTo("DOCUMENT_PRESENCE_STATE");
        assertThat(payload.path("procedureId").asText()).isEqualTo("proc-1");
        assertThat(payload.path("documentId").asText()).isEqualTo("doc-1");
        assertThat(payload.path("observersCount").asInt()).isEqualTo(2);
        assertThat(List.of(payload.path("viewers").get(0).asText(), payload.path("viewers").get(1).asText()))
                .containsExactly("ana", "luis");

        assertThat(otherPayload.path("documentId").asText()).isEqualTo("doc-2");
        assertThat(otherPayload.path("observersCount").asInt()).isEqualTo(1);
        assertThat(otherPayload.path("viewers").get(0).asText()).isEqualTo("sofia");
    }

    @Test
    void removesAViewerFromTheSnapshotWhenTheSocketCloses() throws Exception {
        WebSocketSession ana = session("ana", "ws://localhost/ws/documents/proc-1/doc-1?username=ana");
        WebSocketSession luis = session("luis", "ws://localhost/ws/documents/proc-1/doc-1?username=luis");

        handler.afterConnectionEstablished(ana);
        handler.afterConnectionEstablished(luis);
        handler.afterConnectionClosed(ana, CloseStatus.NORMAL);

        JsonNode payload = payloadFrom(luis);

        assertThat(payload.path("observersCount").asInt()).isEqualTo(1);
        assertThat(payload.path("viewers").isArray()).isTrue();
        assertThat(payload.path("viewers").size()).isEqualTo(1);
        assertThat(payload.path("viewers").get(0).asText()).isEqualTo("luis");
    }

    private WebSocketSession session(String id, String uri) throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.getUri()).thenReturn(new URI(uri));
        when(session.isOpen()).thenReturn(true);
        doNothing().when(session).sendMessage(any(TextMessage.class));
        return session;
    }

    private JsonNode payloadFrom(WebSocketSession session) throws Exception {
        var captor = org.mockito.ArgumentCaptor.forClass(TextMessage.class);
        verify(session, atLeastOnce()).sendMessage(captor.capture());
        return objectMapper.readTree(captor.getValue().getPayload());
    }
}

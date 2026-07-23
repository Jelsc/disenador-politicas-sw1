package com.tuapp.backend.documents.collaboration;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DocumentPresenceRegistry {
    private final Map<String, List<DocumentPresenceParticipant>> activeEditorsByDocument = new ConcurrentHashMap<>();

    public void update(String documentKey, List<DocumentPresenceParticipant> activeEditors) {
        if (documentKey == null || documentKey.isBlank()) {
            return;
        }

        if (activeEditors == null || activeEditors.isEmpty()) {
            activeEditorsByDocument.remove(documentKey);
            return;
        }

        activeEditorsByDocument.put(documentKey, List.copyOf(activeEditors));
    }

    public List<DocumentPresenceParticipant> getActiveEditors(String documentKey) {
        if (documentKey == null || documentKey.isBlank()) {
            return List.of();
        }

        return activeEditorsByDocument.getOrDefault(documentKey, List.of());
    }

    public List<DocumentPresenceParticipant> getActiveEditors(String procedureId, String documentId) {
        return getActiveEditors(toDocumentKey(procedureId, documentId));
    }

    private String toDocumentKey(String procedureId, String documentId) {
        return (procedureId == null || procedureId.isBlank() ? "unknown" : procedureId) + "::" + (documentId == null || documentId.isBlank() ? "unknown" : documentId);
    }
}

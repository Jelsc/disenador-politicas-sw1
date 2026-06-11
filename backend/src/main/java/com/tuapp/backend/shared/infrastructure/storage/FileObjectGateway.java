package com.tuapp.backend.shared.infrastructure.storage;

import java.util.Optional;

public interface FileObjectGateway {
    void put(String key, byte[] content, String contentType);

    byte[] get(String key);

    Optional<String> contentType(String key);

    void delete(String key);
}

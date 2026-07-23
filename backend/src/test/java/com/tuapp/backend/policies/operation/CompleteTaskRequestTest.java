package com.tuapp.backend.policies.operation;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CompleteTaskRequestTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void bindsValuesAndFormValuesPayloads() throws Exception {
        CompleteTaskRequest valuesRequest = objectMapper.readValue(
                "{\"values\":{\"answer\":\"ok\"}}",
                CompleteTaskRequest.class
        );
        CompleteTaskRequest formValuesRequest = objectMapper.readValue(
                "{\"formValues\":{\"answer\":\"ok\"}}",
                CompleteTaskRequest.class
        );

        assertEquals(Map.of("answer", "ok"), valuesRequest.getValues());
        assertEquals(Map.of("answer", "ok"), formValuesRequest.getValues());
    }
}

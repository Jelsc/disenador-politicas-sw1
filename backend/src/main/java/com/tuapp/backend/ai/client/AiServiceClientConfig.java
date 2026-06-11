package com.tuapp.backend.ai.client;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AiServiceClientConfig {

    @Bean
    public RestTemplate aiServiceClientRestTemplate() {
        return new RestTemplate();
    }
}

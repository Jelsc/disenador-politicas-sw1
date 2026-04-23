package com.tuapp.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * MongoDB configuration.
 * Enables auto-indexing and repository scanning.
 */
@Configuration
@EnableMongoRepositories(basePackages = "com.tuapp.backend")
@EnableMongoAuditing
public class MongoConfig {
    // Configuration is handled by Spring Boot auto-configuration
    // and application.properties
}

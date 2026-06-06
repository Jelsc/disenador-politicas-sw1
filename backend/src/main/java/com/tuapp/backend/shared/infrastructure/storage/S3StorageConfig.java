package com.tuapp.backend.shared.infrastructure.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;

import java.net.URI;

@Configuration
public class S3StorageConfig {

    @Bean
    public S3Client s3Client(@Value("${app.storage.s3.region:us-east-1}") String region,
                             @Value("${app.storage.s3.endpoint:}") String endpoint,
                             @Value("${app.storage.s3.access-key:}") String accessKey,
                             @Value("${app.storage.s3.secret-key:}") String secretKey,
                             @Value("${app.storage.s3.force-path-style:true}") boolean forcePathStyle) {
        S3ClientBuilder builder = S3Client.builder().region(Region.of(region));
        if (accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank()) {
            builder.credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)));
        } else {
            builder.credentialsProvider(DefaultCredentialsProvider.create());
        }
        if (endpoint != null && !endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
            builder.forcePathStyle(forcePathStyle);
        }
        return builder.build();
    }
}

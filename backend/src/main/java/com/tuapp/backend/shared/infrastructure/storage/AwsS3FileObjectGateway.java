package com.tuapp.backend.shared.infrastructure.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.Optional;

@Component
public class AwsS3FileObjectGateway implements FileObjectGateway {

    private final S3Client s3Client;
    private final String bucket;

    public AwsS3FileObjectGateway(S3Client s3Client,
                                  @Value("${app.storage.s3.bucket:tuapp-files}") String bucket) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromBytes(content)
        );
    }

    @Override
    public byte[] get(String key) {
        try (ResponseInputStream<GetObjectResponse> response = s3Client.getObject(
                GetObjectRequest.builder().bucket(bucket).key(key).build())) {
            return response.readAllBytes();
        } catch (IOException exception) {
            throw new RuntimeException("Could not read file " + key, exception);
        }
    }

    @Override
    public Optional<String> contentType(String key) {
        try {
            return Optional.ofNullable(s3Client.headObject(
                    HeadObjectRequest.builder().bucket(bucket).key(key).build()).contentType());
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    @Override
    public void delete(String key) {
        try {
            s3Client.deleteObject(software.amazon.awssdk.services.s3.model.DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (Exception exception) {
            throw new RuntimeException("Could not delete file " + key, exception);
        }
    }
}

package com.tuapp.backend.policies.infrastructure;

import com.tuapp.backend.policies.domain.model.Policy;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MongoPolicyRepository extends MongoRepository<Policy, String> {
}

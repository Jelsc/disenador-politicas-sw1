package com.tuapp.backend.shared.application;

/**
 * Base interface for all use cases.
 * Represents a single business operation.
 *
 * @param <I> Input/Request type
 * @param <O> Output/Response type
 */
public interface UseCase<I, O> {
    O execute(I input);
}

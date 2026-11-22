package uk.emoshin.taf.aiagent.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public final class ChatDtos {

    private ChatDtos() {
    }

    public record ChatMessageInput(
            @NotBlank(message = "Message role is required")
            String role,

            @NotBlank(message = "Message content is required")
            String content
    ) {
    }

    public record ChatRequest(
            String chatId,

            @NotBlank(message = "Model is required")
            String model,

            boolean stream,

            @NotEmpty(message = "Messages must not be empty")
            List<@Valid ChatMessageInput> messages
    ) {
    }

    public record ChatMessageResponse(
            UUID id,
            String role,
            String content,
            int tokenCount,
            long createdAt
    ) {
    }

    public record ChatSessionResponse(
            UUID id,
            String title,
            String model,
            String provider,
            long createdAt,
            long updatedAt,
            List<ChatMessageResponse> messages
    ) {
    }
}

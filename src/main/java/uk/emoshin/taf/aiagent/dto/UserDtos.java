package uk.emoshin.taf.aiagent.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.domain.UserRole;
import uk.emoshin.taf.aiagent.domain.UserStatus;

import java.util.List;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "Name is required")
            @Size(max = 120, message = "Name must be at most 120 characters")
            String name,

            @NotBlank(message = "Email is required")
            @Email(message = "Valid email is required")
            @Size(max = 190, message = "Email must be at most 190 characters")
            String email,

            @NotBlank(message = "Password is required")
            @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
            String password,

            @Size(max = 120)
            String subtitle,

            String avatarUrl
    ) {
    }

    public record LoginRequest(
            @NotBlank(message = "Email is required")
            @Email(message = "Valid email is required")
            String email,

            @NotBlank(message = "Password is required")
            String password
    ) {
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Name is required")
            @Size(max = 120, message = "Name must be at most 120 characters")
            String name,

            @Size(max = 120, message = "Subtitle must be at most 120 characters")
            String subtitle,

            String avatarUrl,

            @Size(min = 6, max = 100, message = "New password must be between 6 and 100 characters")
            String newPassword
    ) {
    }

    public record TokenUsageSummaryDto(
            long promptTokens,
            long completionTokens,
            long totalTokens,
            long tokenLimit,
            double estimatedCostUsd
    ) {
    }

    public record ModelUsageDto(
            String model,
            AgentProvider provider,
            long promptTokens,
            long completionTokens,
            long totalTokens,
            double estimatedCostUsd
    ) {
    }

    public record UserProfileResponse(
            UUID id,
            String name,
            String subtitle,
            String email,
            UserRole role,
            UserStatus status,
            String avatarUrl,
            long createdAt,
            long lastActiveAt,
            TokenUsageSummaryDto tokenUsage,
            List<ModelUsageDto> modelBreakdown
    ) {
    }

    public record AuthResponse(
            String accessToken,
            UserProfileResponse user
    ) {
    }
}

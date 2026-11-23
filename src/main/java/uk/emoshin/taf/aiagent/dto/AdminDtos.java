package uk.emoshin.taf.aiagent.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import uk.emoshin.taf.aiagent.domain.UserRole;
import uk.emoshin.taf.aiagent.domain.UserStatus;

import java.util.List;
import java.util.UUID;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record AdminCreateUserRequest(
            @NotBlank(message = "Name is required")
            @Size(max = 120)
            String name,

            @NotBlank(message = "Email is required")
            @Email(message = "Valid email is required")
            @Size(max = 190)
            String email,

            @Size(min = 6, max = 100)
            String password,

            UserRole role,

            @Min(value = 1000, message = "Token limit must be at least 1000")
            Long tokenLimit,

            String avatarUrl
    ) {
    }

    public record UpdateUserStatusRequest(
            @NotNull(message = "Status is required")
            UserStatus status
    ) {
    }

    public record SetUserPasswordRequest(
            @NotBlank(message = "Password is required")
            @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
            String password
    ) {
    }

    public record AdminUserDto(
            UUID id,
            String name,
            String subtitle,
            String email,
            UserRole role,
            UserStatus status,
            String avatarUrl,
            long createdAt,
            long lastActiveAt,
            UserDtos.TokenUsageSummaryDto tokenUsage,
            List<UserDtos.ModelUsageDto> modelBreakdown,
            long chatCount
    ) {
    }

    public record UpsertProviderTokenRequest(
            @NotBlank(message = "Provider is required")
            String provider,

            @NotBlank(message = "API key is required")
            String apiKey,

            String baseUrl
    ) {
    }

    public record ProviderTokenResponse(
            String provider,
            String label,
            String baseUrl,
            boolean configured,
            String maskedKey,
            Long updatedAt
    ) {
    }

    public record GlobalTokenStatsResponse(
            long totalUsers,
            long activeUsers,
            long suspendedUsers,
            long totalTokens,
            double estimatedCostUsd,
            double openAiEstimatedCostUsd,
            double anthropicEstimatedCostUsd,
            List<UserDtos.ModelUsageDto> modelBreakdown
    ) {
    }

    public record OpenAiCostsRequest(
            String adminApiKey,
            Integer days
    ) {
    }

    public record OpenAiCostsResponse(
            boolean available,
            int periodDays,
            double totalSpendUsd,
            boolean remainingBalanceSupported,
            String source,
            String message
    ) {
    }

    public record ChatBackupDto(
            String backupVersion,
            long exportedAt,
            UUID chatId,
            UUID userId,
            String userName,
            String userEmail,
            String title,
            String model,
            String provider,
            boolean deletedByUser,
            Long deletedAt,
            long createdAt,
            long updatedAt,
            int messageCount,
            long totalTokens,
            double estimatedCostUsd,
            List<ChatDtos.ChatMessageResponse> messages
    ) {
    }

    public record WorkspaceChatsBackupDto(
            String backupVersion,
            long exportedAt,
            int totalChats,
            int deletedChats,
            List<ChatBackupDto> chats
    ) {
    }
}

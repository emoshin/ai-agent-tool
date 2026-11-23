package uk.emoshin.taf.aiagent.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.emoshin.taf.aiagent.domain.AppUser;
import uk.emoshin.taf.aiagent.domain.ChatMessageEntity;
import uk.emoshin.taf.aiagent.domain.ChatSessionEntity;
import uk.emoshin.taf.aiagent.domain.UserRole;
import uk.emoshin.taf.aiagent.domain.UserStatus;
import uk.emoshin.taf.aiagent.dto.AdminDtos.AdminCreateUserRequest;
import uk.emoshin.taf.aiagent.dto.AdminDtos.AdminUserDto;
import uk.emoshin.taf.aiagent.dto.AdminDtos.ChatBackupDto;
import uk.emoshin.taf.aiagent.dto.AdminDtos.WorkspaceChatsBackupDto;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatMessageResponse;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatSessionResponse;
import uk.emoshin.taf.aiagent.repository.AppUserRepository;
import uk.emoshin.taf.aiagent.repository.ChatSessionRepository;
import uk.emoshin.taf.aiagent.web.ApiException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AdminService {

    private final AppUserRepository appUserRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final TokenStatsService tokenStatsService;
    private final ModelPricingService modelPricingService;
    private final PasswordEncoder passwordEncoder;

    public AdminService(
            AppUserRepository appUserRepository,
            ChatSessionRepository chatSessionRepository,
            TokenStatsService tokenStatsService,
            ModelPricingService modelPricingService,
            PasswordEncoder passwordEncoder
    ) {
        this.appUserRepository = appUserRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.tokenStatsService = tokenStatsService;
        this.modelPricingService = modelPricingService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<AdminUserDto> listUsers() {
        return appUserRepository.findAll().stream()
                .sorted(Comparator.comparingLong(AppUser::getCreatedAt))
                .map(this::toAdminUserDto)
                .toList();
    }

    @Transactional
    public AdminUserDto createUser(AdminCreateUserRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        if (appUserRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ApiException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        long now = Instant.now().toEpochMilli();
        String rawPassword = (request.password() != null && !request.password().isBlank())
                ? request.password()
                : UUID.randomUUID().toString();

        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        user.setName(request.name().trim());
        user.setSubtitle(request.role() == UserRole.ADMIN ? "Administrator" : "Workspace Member");
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole(request.role() != null ? request.role() : UserRole.MEMBER);
        user.setStatus(UserStatus.ACTIVE);
        user.setAvatarUrl(request.avatarUrl() != null && !request.avatarUrl().isBlank()
                ? request.avatarUrl().trim()
                : null);
        user.setTokenLimit(request.tokenLimit() != null ? request.tokenLimit() : 250_000L);
        user.setCreatedAt(now);
        user.setLastActiveAt(now);

        return toAdminUserDto(appUserRepository.save(user));
    }

    @Transactional
    public AdminUserDto updateUserStatus(UUID userId, UserStatus status) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        user.setStatus(status);
        return toAdminUserDto(appUserRepository.save(user));
    }

    @Transactional
    public void setUserPassword(UUID userId, String rawPassword) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        appUserRepository.save(user);
    }

    @Transactional
    public void deleteUser(UUID userId) {
        if (!appUserRepository.existsById(userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User not found");
        }
        appUserRepository.deleteById(userId);
    }

    @Transactional(readOnly = true)
    public List<ChatSessionResponse> getUserChats(UUID userId) {
        if (!appUserRepository.existsById(userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User not found");
        }
        return chatSessionRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(AdminService::toChatSessionResponse)
                .toList();
    }

    @Transactional
    public void deleteUserChat(UUID userId, UUID chatId) {
        ChatSessionEntity chat = chatSessionRepository.findByIdAndUserId(chatId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Chat session not found"));
        chatSessionRepository.delete(chat);
    }

    @Transactional(readOnly = true)
    public ChatBackupDto backupChat(UUID chatId) {
        ChatSessionEntity chat = chatSessionRepository.findWithDetailsById(chatId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Chat session not found"));
        return toChatBackupDto(chat, Instant.now().toEpochMilli());
    }

    @Transactional(readOnly = true)
    public WorkspaceChatsBackupDto backupUserChats(UUID userId) {
        if (!appUserRepository.existsById(userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User not found");
        }
        long exportedAt = Instant.now().toEpochMilli();
        List<ChatBackupDto> chats = chatSessionRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(chat -> toChatBackupDto(chat, exportedAt))
                .toList();
        int deletedCount = (int) chats.stream().filter(ChatBackupDto::deletedByUser).count();
        return new WorkspaceChatsBackupDto("1.0", exportedAt, chats.size(), deletedCount, chats);
    }

    @Transactional(readOnly = true)
    public WorkspaceChatsBackupDto backupAllChats() {
        long exportedAt = Instant.now().toEpochMilli();
        List<ChatBackupDto> chats = chatSessionRepository.findAllByOrderByUpdatedAtDesc().stream()
                .map(chat -> toChatBackupDto(chat, exportedAt))
                .toList();
        int deletedCount = (int) chats.stream().filter(ChatBackupDto::deletedByUser).count();
        return new WorkspaceChatsBackupDto("1.0", exportedAt, chats.size(), deletedCount, chats);
    }

    private ChatBackupDto toChatBackupDto(ChatSessionEntity chat, long exportedAt) {
        List<ChatMessageResponse> messages = chat.getMessages().stream()
                .map(AdminService::toMessageResponse)
                .toList();
        long promptTokens = messages.stream()
                .filter(m -> !"assistant".equalsIgnoreCase(m.role()))
                .mapToLong(ChatMessageResponse::tokenCount)
                .sum();
        long completionTokens = messages.stream()
                .filter(m -> "assistant".equalsIgnoreCase(m.role()))
                .mapToLong(ChatMessageResponse::tokenCount)
                .sum();
        long totalTokens = promptTokens + completionTokens;
        double estimatedCostUsd = modelPricingService.estimateCostUsd(chat.getModel(), promptTokens, completionTokens);

        AppUser owner = chat.getUser();
        return new ChatBackupDto(
                "1.0",
                exportedAt,
                chat.getId(),
                owner.getId(),
                owner.getName(),
                owner.getEmail(),
                chat.getTitle(),
                chat.getModel(),
                chat.getProvider().toCode(),
                chat.isDeleted(),
                chat.getDeletedAt(),
                chat.getCreatedAt(),
                chat.getUpdatedAt(),
                messages.size(),
                totalTokens,
                estimatedCostUsd,
                messages
        );
    }

    private AdminUserDto toAdminUserDto(AppUser user) {
        return new AdminUserDto(
                user.getId(),
                user.getName(),
                user.getSubtitle(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getAvatarUrl(),
                user.getCreatedAt(),
                user.getLastActiveAt(),
                tokenStatsService.getUserTokenSummary(user.getId(), user.getTokenLimit()),
                tokenStatsService.getUserModelBreakdown(user.getId()),
                chatSessionRepository.countByUserId(user.getId())
        );
    }

    public static ChatSessionResponse toChatSessionResponse(ChatSessionEntity chat) {
        List<ChatMessageResponse> messages = chat.getMessages().stream()
                .map(AdminService::toMessageResponse)
                .toList();
        return new ChatSessionResponse(
                chat.getId(),
                chat.getTitle(),
                chat.getModel(),
                chat.getProvider().toCode(),
                chat.getCreatedAt(),
                chat.getUpdatedAt(),
                chat.isDeleted(),
                chat.getDeletedAt(),
                messages
        );
    }

    private static ChatMessageResponse toMessageResponse(ChatMessageEntity message) {
        return new ChatMessageResponse(
                message.getId(),
                message.getRole(),
                message.getContent(),
                message.getTokenCount(),
                message.getCreatedAt()
        );
    }
}

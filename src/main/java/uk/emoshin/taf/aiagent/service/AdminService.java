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
    private final PasswordEncoder passwordEncoder;

    public AdminService(
            AppUserRepository appUserRepository,
            ChatSessionRepository chatSessionRepository,
            TokenStatsService tokenStatsService,
            PasswordEncoder passwordEncoder
    ) {
        this.appUserRepository = appUserRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.tokenStatsService = tokenStatsService;
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

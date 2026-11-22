package uk.emoshin.taf.aiagent.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.emoshin.taf.aiagent.domain.AppUser;
import uk.emoshin.taf.aiagent.domain.UserRole;
import uk.emoshin.taf.aiagent.domain.UserStatus;
import uk.emoshin.taf.aiagent.dto.UserDtos.AuthResponse;
import uk.emoshin.taf.aiagent.dto.UserDtos.LoginRequest;
import uk.emoshin.taf.aiagent.dto.UserDtos.ModelUsageDto;
import uk.emoshin.taf.aiagent.dto.UserDtos.RegisterRequest;
import uk.emoshin.taf.aiagent.dto.UserDtos.TokenUsageSummaryDto;
import uk.emoshin.taf.aiagent.dto.UserDtos.UpdateProfileRequest;
import uk.emoshin.taf.aiagent.dto.UserDtos.UserProfileResponse;
import uk.emoshin.taf.aiagent.repository.AppUserRepository;
import uk.emoshin.taf.aiagent.security.JwtService;
import uk.emoshin.taf.aiagent.web.ApiException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class UserService {

    private static final long DEFAULT_TOKEN_LIMIT = 250_000L;

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenStatsService tokenStatsService;

    public UserService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            TokenStatsService tokenStatsService
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.tokenStatsService = tokenStatsService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        if (appUserRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ApiException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        long now = Instant.now().toEpochMilli();
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        user.setName(request.name().trim());
        user.setSubtitle(request.subtitle() != null && !request.subtitle().isBlank()
                ? request.subtitle().trim()
                : "Workspace Member");
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.MEMBER);
        user.setStatus(UserStatus.ACTIVE);
        user.setAvatarUrl(request.avatarUrl() != null && !request.avatarUrl().isBlank()
                ? request.avatarUrl().trim()
                : null);
        user.setTokenLimit(DEFAULT_TOKEN_LIMIT);
        user.setCreatedAt(now);
        user.setLastActiveAt(now);

        AppUser saved = appUserRepository.save(user);
        String jwt = jwtService.generateToken(saved);
        return new AuthResponse(jwt, toProfileResponse(saved));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        AppUser user = appUserRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "User account is suspended");
        }

        user.setLastActiveAt(Instant.now().toEpochMilli());
        AppUser saved = appUserRepository.save(user);
        String jwt = jwtService.generateToken(saved);
        return new AuthResponse(jwt, toProfileResponse(saved));
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(UUID userId) {
        AppUser user = getActiveOrExistingUser(userId);
        return toProfileResponse(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        AppUser user = getActiveOrExistingUser(userId);
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Suspended accounts cannot update profile data");
        }

        user.setName(request.name().trim());
        if (request.subtitle() != null) {
            user.setSubtitle(request.subtitle().isBlank() ? "Workspace Member" : request.subtitle().trim());
        }
        if (request.avatarUrl() != null) {
            user.setAvatarUrl(request.avatarUrl().isBlank() ? null : request.avatarUrl().trim());
        }
        if (request.newPassword() != null && !request.newPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        }
        user.setLastActiveAt(Instant.now().toEpochMilli());

        AppUser saved = appUserRepository.save(user);
        return toProfileResponse(saved);
    }

    @Transactional(readOnly = true)
    public AppUser requireActiveUser(UUID userId) {
        AppUser user = getActiveOrExistingUser(userId);
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "User account is suspended");
        }
        return user;
    }

    private AppUser getActiveOrExistingUser(UUID userId) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    public UserProfileResponse toProfileResponse(AppUser user) {
        TokenUsageSummaryDto summary = tokenStatsService.getUserTokenSummary(user.getId(), user.getTokenLimit());
        List<ModelUsageDto> breakdown = tokenStatsService.getUserModelBreakdown(user.getId());
        return new UserProfileResponse(
                user.getId(),
                user.getName(),
                user.getSubtitle(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getAvatarUrl(),
                user.getCreatedAt(),
                user.getLastActiveAt(),
                summary,
                breakdown
        );
    }
}

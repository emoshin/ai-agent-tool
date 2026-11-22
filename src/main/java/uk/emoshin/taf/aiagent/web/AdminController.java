package uk.emoshin.taf.aiagent.web;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uk.emoshin.taf.aiagent.dto.AdminDtos.AdminCreateUserRequest;
import uk.emoshin.taf.aiagent.dto.AdminDtos.AdminUserDto;
import uk.emoshin.taf.aiagent.dto.AdminDtos.GlobalTokenStatsResponse;
import uk.emoshin.taf.aiagent.dto.AdminDtos.OpenAiCostsRequest;
import uk.emoshin.taf.aiagent.dto.AdminDtos.OpenAiCostsResponse;
import uk.emoshin.taf.aiagent.dto.AdminDtos.ProviderTokenResponse;
import uk.emoshin.taf.aiagent.dto.AdminDtos.UpdateUserStatusRequest;
import uk.emoshin.taf.aiagent.dto.AdminDtos.UpsertProviderTokenRequest;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatSessionResponse;
import uk.emoshin.taf.aiagent.security.UserPrincipal;
import uk.emoshin.taf.aiagent.service.AdminService;
import uk.emoshin.taf.aiagent.service.OpenAiBillingService;
import uk.emoshin.taf.aiagent.service.ProviderTokenService;
import uk.emoshin.taf.aiagent.service.TokenStatsService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final ProviderTokenService providerTokenService;
    private final TokenStatsService tokenStatsService;
    private final OpenAiBillingService openAiBillingService;

    public AdminController(
            AdminService adminService,
            ProviderTokenService providerTokenService,
            TokenStatsService tokenStatsService,
            OpenAiBillingService openAiBillingService
    ) {
        this.adminService = adminService;
        this.providerTokenService = providerTokenService;
        this.tokenStatsService = tokenStatsService;
        this.openAiBillingService = openAiBillingService;
    }

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserDto>> listUsers() {
        return ResponseEntity.ok(adminService.listUsers());
    }

    @PostMapping("/users")
    public ResponseEntity<AdminUserDto> createUser(@Valid @RequestBody AdminCreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createUser(request));
    }

    @PatchMapping("/users/{id}/status")
    public ResponseEntity<AdminUserDto> updateUserStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        return ResponseEntity.ok(adminService.updateUserStatus(id, request.status()));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        adminService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{id}/chats")
    public ResponseEntity<List<ChatSessionResponse>> getUserChats(@PathVariable UUID id) {
        return ResponseEntity.ok(adminService.getUserChats(id));
    }

    @DeleteMapping("/users/{userId}/chats/{chatId}")
    public ResponseEntity<Void> deleteUserChat(
            @PathVariable UUID userId,
            @PathVariable UUID chatId
    ) {
        adminService.deleteUserChat(userId, chatId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/provider-tokens")
    public ResponseEntity<List<ProviderTokenResponse>> listProviderTokens() {
        return ResponseEntity.ok(providerTokenService.listMaskedTokens());
    }

    @PostMapping("/provider-tokens")
    public ResponseEntity<ProviderTokenResponse> upsertProviderToken(
            @AuthenticationPrincipal UserPrincipal adminPrincipal,
            @Valid @RequestBody UpsertProviderTokenRequest request
    ) {
        return ResponseEntity.ok(providerTokenService.upsertToken(adminPrincipal.getId(), request));
    }

    @DeleteMapping("/provider-tokens/{provider}")
    public ResponseEntity<Void> deleteProviderToken(@PathVariable String provider) {
        providerTokenService.deleteToken(provider);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats/tokens")
    public ResponseEntity<GlobalTokenStatsResponse> getTokenStats() {
        return ResponseEntity.ok(tokenStatsService.getGlobalStats());
    }

    @PostMapping("/billing/openai-costs")
    public ResponseEntity<OpenAiCostsResponse> getOpenAiOrgCosts(
            @RequestBody(required = false) OpenAiCostsRequest request
    ) {
        return ResponseEntity.ok(openAiBillingService.fetchOrganizationCosts(request));
    }
}

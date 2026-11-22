package uk.emoshin.taf.aiagent.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.domain.ProviderToken;
import uk.emoshin.taf.aiagent.dto.AdminDtos.ProviderTokenResponse;
import uk.emoshin.taf.aiagent.dto.AdminDtos.UpsertProviderTokenRequest;
import uk.emoshin.taf.aiagent.repository.ProviderTokenRepository;
import uk.emoshin.taf.aiagent.security.TokenEncryptionService;
import uk.emoshin.taf.aiagent.web.ApiException;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ProviderTokenService {

    public record DecryptedProviderCredential(
            AgentProvider provider,
            String apiKey,
            String baseUrl
    ) {
    }

    private final ProviderTokenRepository providerTokenRepository;
    private final TokenEncryptionService tokenEncryptionService;

    public ProviderTokenService(
            ProviderTokenRepository providerTokenRepository,
            TokenEncryptionService tokenEncryptionService
    ) {
        this.providerTokenRepository = providerTokenRepository;
        this.tokenEncryptionService = tokenEncryptionService;
    }

    @Transactional
    public ProviderTokenResponse upsertToken(UUID adminId, UpsertProviderTokenRequest request) {
        AgentProvider provider = AgentProvider.fromCode(request.provider());
        String cleanApiKey = request.apiKey().trim();
        String cleanBaseUrl = (request.baseUrl() == null || request.baseUrl().isBlank())
                ? provider.getDefaultBaseUrl()
                : request.baseUrl().trim().replaceAll("/+$", "");

        ProviderToken entity = providerTokenRepository.findById(provider).orElseGet(ProviderToken::new);
        entity.setProvider(provider);
        entity.setLabel(provider.getDisplayLabel());
        entity.setEncryptedApiKey(tokenEncryptionService.encrypt(cleanApiKey));
        entity.setBaseUrl(cleanBaseUrl);
        entity.setUpdatedAt(Instant.now().toEpochMilli());
        entity.setUpdatedByAdminId(adminId);

        ProviderToken saved = providerTokenRepository.save(entity);
        return toMaskedResponse(saved, TokenEncryptionService.mask(cleanApiKey));
    }

    @Transactional(readOnly = true)
    public List<ProviderTokenResponse> listMaskedTokens() {
        Map<AgentProvider, ProviderToken> byProvider = providerTokenRepository.findAll().stream()
                .collect(Collectors.toMap(ProviderToken::getProvider, Function.identity()));

        return Arrays.stream(AgentProvider.values())
                .map(provider -> {
                    ProviderToken token = byProvider.get(provider);
                    if (token == null) {
                        return new ProviderTokenResponse(
                                provider.toCode(),
                                provider.getDisplayLabel(),
                                provider.getDefaultBaseUrl(),
                                false,
                                "",
                                null
                        );
                    }
                    String decrypted = tokenEncryptionService.decrypt(token.getEncryptedApiKey());
                    return toMaskedResponse(token, TokenEncryptionService.mask(decrypted));
                })
                .toList();
    }

    @Transactional
    public void deleteToken(String providerCode) {
        AgentProvider provider = AgentProvider.fromCode(providerCode);
        providerTokenRepository.deleteById(provider);
    }

    @Transactional(readOnly = true)
    public DecryptedProviderCredential resolveCredential(AgentProvider provider) {
        ProviderToken token = providerTokenRepository.findById(provider)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "Provider API token for " + provider.getDisplayLabel()
                                + " is not configured by an administrator"
                ));

        String rawKey = tokenEncryptionService.decrypt(token.getEncryptedApiKey());
        String baseUrl = (token.getBaseUrl() == null || token.getBaseUrl().isBlank())
                ? provider.getDefaultBaseUrl()
                : token.getBaseUrl().trim().replaceAll("/+$", "");

        return new DecryptedProviderCredential(provider, rawKey, baseUrl);
    }

    private ProviderTokenResponse toMaskedResponse(ProviderToken entity, String maskedKey) {
        return new ProviderTokenResponse(
                entity.getProvider().toCode(),
                entity.getLabel(),
                entity.getBaseUrl(),
                true,
                maskedKey,
                entity.getUpdatedAt()
        );
    }
}

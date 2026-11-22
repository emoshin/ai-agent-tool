package uk.emoshin.taf.aiagent.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.domain.AppUser;
import uk.emoshin.taf.aiagent.domain.TokenUsageRecord;
import uk.emoshin.taf.aiagent.domain.UserStatus;
import uk.emoshin.taf.aiagent.dto.AdminDtos.GlobalTokenStatsResponse;
import uk.emoshin.taf.aiagent.dto.UserDtos.ModelUsageDto;
import uk.emoshin.taf.aiagent.dto.UserDtos.TokenUsageSummaryDto;
import uk.emoshin.taf.aiagent.repository.AppUserRepository;
import uk.emoshin.taf.aiagent.repository.TokenUsageRecordRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class TokenStatsService {

    private final TokenUsageRecordRepository tokenUsageRecordRepository;
    private final AppUserRepository appUserRepository;
    private final ModelPricingService modelPricingService;

    public TokenStatsService(
            TokenUsageRecordRepository tokenUsageRecordRepository,
            AppUserRepository appUserRepository,
            ModelPricingService modelPricingService
    ) {
        this.tokenUsageRecordRepository = tokenUsageRecordRepository;
        this.appUserRepository = appUserRepository;
        this.modelPricingService = modelPricingService;
    }

    @Transactional
    public TokenUsageRecord recordUsage(
            AppUser user,
            UUID chatSessionId,
            String model,
            AgentProvider provider,
            long promptTokens,
            long completionTokens
    ) {
        long safePrompt = Math.max(0L, promptTokens);
        long safeCompletion = Math.max(0L, completionTokens);

        TokenUsageRecord record = new TokenUsageRecord();
        record.setId(UUID.randomUUID());
        record.setUser(user);
        record.setChatSessionId(chatSessionId);
        record.setModel(model);
        record.setProvider(provider);
        record.setPromptTokens(safePrompt);
        record.setCompletionTokens(safeCompletion);
        record.setTotalTokens(safePrompt + safeCompletion);
        record.setCreatedAt(Instant.now().toEpochMilli());
        return tokenUsageRecordRepository.save(record);
    }

    @Transactional(readOnly = true)
    public TokenUsageSummaryDto getUserTokenSummary(UUID userId, long tokenLimit) {
        TokenUsageRecordRepository.UserTotalsProjection totals =
                tokenUsageRecordRepository.sumTotalsByUserId(userId);
        long prompt = totals != null && totals.getPromptTokens() != null ? totals.getPromptTokens() : 0L;
        long completion = totals != null && totals.getCompletionTokens() != null ? totals.getCompletionTokens() : 0L;
        long total = totals != null && totals.getTotalTokens() != null ? totals.getTotalTokens() : 0L;
        double estimatedCostUsd = ModelPricingService.roundUsd(
                getUserModelBreakdown(userId).stream()
                        .mapToDouble(ModelUsageDto::estimatedCostUsd)
                        .sum()
        );
        return new TokenUsageSummaryDto(prompt, completion, total, tokenLimit, estimatedCostUsd);
    }

    @Transactional(readOnly = true)
    public List<ModelUsageDto> getUserModelBreakdown(UUID userId) {
        return tokenUsageRecordRepository.sumByModelForUser(userId).stream()
                .map(this::toModelUsageDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public GlobalTokenStatsResponse getGlobalStats() {
        List<AppUser> users = appUserRepository.findAll();
        long totalUsers = users.size();
        long activeUsers = users.stream().filter(u -> u.getStatus() == UserStatus.ACTIVE).count();
        long suspendedUsers = users.stream().filter(u -> u.getStatus() == UserStatus.SUSPENDED).count();

        List<ModelUsageDto> modelBreakdown = tokenUsageRecordRepository.sumGlobalByModel().stream()
                .map(this::toModelUsageDto)
                .toList();

        long totalTokens = modelBreakdown.stream().mapToLong(ModelUsageDto::totalTokens).sum();
        double openAiCost = ModelPricingService.roundUsd(
                modelBreakdown.stream()
                        .filter(m -> m.provider() == AgentProvider.OPENAI)
                        .mapToDouble(ModelUsageDto::estimatedCostUsd)
                        .sum()
        );
        double anthropicCost = ModelPricingService.roundUsd(
                modelBreakdown.stream()
                        .filter(m -> m.provider() == AgentProvider.ANTHROPIC)
                        .mapToDouble(ModelUsageDto::estimatedCostUsd)
                        .sum()
        );
        double totalEstimatedCost = ModelPricingService.roundUsd(openAiCost + anthropicCost);

        return new GlobalTokenStatsResponse(
                totalUsers,
                activeUsers,
                suspendedUsers,
                totalTokens,
                totalEstimatedCost,
                openAiCost,
                anthropicCost,
                modelBreakdown
        );
    }

    private ModelUsageDto toModelUsageDto(TokenUsageRecordRepository.ModelUsageProjection p) {
        long prompt = p.getPromptTokens() != null ? p.getPromptTokens() : 0L;
        long completion = p.getCompletionTokens() != null ? p.getCompletionTokens() : 0L;
        long total = p.getTotalTokens() != null ? p.getTotalTokens() : 0L;
        double cost = modelPricingService.estimateCostUsd(p.getModel(), prompt, completion);
        return new ModelUsageDto(p.getModel(), p.getProvider(), prompt, completion, total, cost);
    }
}

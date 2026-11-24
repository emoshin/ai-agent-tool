package uk.emoshin.taf.aiagent.service;

import org.springframework.stereotype.Service;
import uk.emoshin.taf.aiagent.domain.AgentProvider;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

@Service
public class ModelPricingService {

    public record ModelPriceRate(double inputUsdPerMillion, double outputUsdPerMillion) {
    }

    private static final double ONE_MILLION = 1_000_000.0;

    private final ModelRoutingHelper modelRoutingHelper;

    public ModelPricingService(ModelRoutingHelper modelRoutingHelper) {
        this.modelRoutingHelper = modelRoutingHelper;
    }

    public ModelPriceRate getRateForModel(String model) {
        String lower = model == null ? "" : model.trim().toLowerCase(Locale.ROOT);

        if (lower.contains("gpt-5-nano")) {
            return new ModelPriceRate(0.05, 0.40);
        }
        if (lower.contains("gpt-4o-mini")) {
            return new ModelPriceRate(0.15, 0.60);
        }
        if (lower.contains("gpt-6.2-sol") || lower.contains("gpt-4o") || "agent-4o".equals(lower)) {
            return new ModelPriceRate(2.50, 10.00);
        }
        if (lower.contains("o3-mini") || "agent-o3-mini".equals(lower)) {
            return new ModelPriceRate(1.10, 4.40);
        }
        if (lower.contains("o1") || lower.contains("o3") || lower.contains("o4")) {
            return new ModelPriceRate(2.00, 8.00);
        }
        if (lower.contains("claude") && lower.contains("opus")) {
            return new ModelPriceRate(15.00, 75.00);
        }
        if (lower.contains("claude") && lower.contains("haiku")) {
            return new ModelPriceRate(0.80, 4.00);
        }
        if (lower.contains("claude") && lower.contains("sonnet")) {
            return new ModelPriceRate(3.00, 15.00);
        }

        try {
            AgentProvider provider = modelRoutingHelper.resolveProvider(model);
            if (provider == AgentProvider.ANTHROPIC) {
                return new ModelPriceRate(3.00, 15.00);
            }
        } catch (IllegalArgumentException ignored) {
        }

        return new ModelPriceRate(2.50, 10.00);
    }

    public double estimateCostUsd(String model, long promptTokens, long completionTokens) {
        ModelPriceRate rate = getRateForModel(model);
        double inputCost = (Math.max(0L, promptTokens) / ONE_MILLION) * rate.inputUsdPerMillion();
        double outputCost = (Math.max(0L, completionTokens) / ONE_MILLION) * rate.outputUsdPerMillion();
        return roundUsd(inputCost + outputCost);
    }

    public static double roundUsd(double value) {
        return BigDecimal.valueOf(Math.max(0.0, value))
                .setScale(6, RoundingMode.HALF_UP)
                .doubleValue();
    }
}

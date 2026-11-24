package uk.emoshin.taf.aiagent.service;

import org.junit.jupiter.api.Test;
import uk.emoshin.taf.aiagent.domain.AgentProvider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ModelRoutingAndPricingTest {

    private final ModelRoutingHelper routingHelper = new ModelRoutingHelper();
    private final ModelPricingService pricingService = new ModelPricingService(routingHelper);

    @Test
    void resolvesProvidersAndUpstreamModelsForAllConfiguredModels() {
        assertThat(routingHelper.resolveProvider("gpt-6.2-sol")).isEqualTo(AgentProvider.OPENAI);
        assertThat(routingHelper.resolveUpstreamModel("gpt-6.2-sol")).isEqualTo("gpt-6.2-sol");

        assertThat(routingHelper.resolveProvider("gpt-5-nano")).isEqualTo(AgentProvider.OPENAI);
        assertThat(routingHelper.resolveUpstreamModel("gpt-5-nano")).isEqualTo("gpt-5-nano");

        assertThat(routingHelper.resolveProvider("claude-opus-5-5")).isEqualTo(AgentProvider.ANTHROPIC);
        assertThat(routingHelper.resolveUpstreamModel("claude-opus-5-5")).isEqualTo("claude-opus-5-5");

        assertThat(routingHelper.resolveProvider("claude-3-5-haiku")).isEqualTo(AgentProvider.ANTHROPIC);
        assertThat(routingHelper.resolveUpstreamModel("claude-3-5-haiku")).isEqualTo("claude-3-5-haiku-latest");
    }

    @Test
    void calculatesRatesAndCostsForFlagshipAndLowestCostModels() {
        assertThat(pricingService.getRateForModel("gpt-6.2-sol"))
                .isEqualTo(new ModelPricingService.ModelPriceRate(2.50, 10.00));
        assertThat(pricingService.getRateForModel("gpt-5-nano"))
                .isEqualTo(new ModelPricingService.ModelPriceRate(0.05, 0.40));
        assertThat(pricingService.getRateForModel("claude-opus-5-5"))
                .isEqualTo(new ModelPricingService.ModelPriceRate(15.00, 75.00));
        assertThat(pricingService.getRateForModel("claude-3-5-haiku"))
                .isEqualTo(new ModelPricingService.ModelPriceRate(0.80, 4.00));

        // 1M prompt + 1M completion tokens = input rate + output rate
        assertThat(pricingService.estimateCostUsd("gpt-5-nano", 1_000_000L, 1_000_000L))
                .isCloseTo(0.45, within(0.000001));
        assertThat(pricingService.estimateCostUsd("claude-3-5-haiku", 1_000_000L, 1_000_000L))
                .isCloseTo(4.80, within(0.000001));
    }
}

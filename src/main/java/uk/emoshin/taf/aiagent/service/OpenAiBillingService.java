package uk.emoshin.taf.aiagent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.dto.AdminDtos.OpenAiCostsRequest;
import uk.emoshin.taf.aiagent.dto.AdminDtos.OpenAiCostsResponse;
import uk.emoshin.taf.aiagent.service.ProviderTokenService.DecryptedProviderCredential;
import uk.emoshin.taf.aiagent.web.ApiException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class OpenAiBillingService {

    private final ProviderTokenService providerTokenService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public OpenAiBillingService(ProviderTokenService providerTokenService, ObjectMapper objectMapper) {
        this(
                providerTokenService,
                objectMapper,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
        );
    }

    public OpenAiBillingService(
            ProviderTokenService providerTokenService,
            ObjectMapper objectMapper,
            HttpClient httpClient
    ) {
        this.providerTokenService = providerTokenService;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    public OpenAiCostsResponse fetchOrganizationCosts(OpenAiCostsRequest request) {
        int days = (request != null && request.days() != null && request.days() >= 1 && request.days() <= 31)
                ? request.days()
                : 30;

        String explicitKey = request != null && request.adminApiKey() != null
                ? request.adminApiKey().trim()
                : "";

        String apiKey;
        String baseUrl = AgentProvider.OPENAI.getDefaultBaseUrl();

        try {
            DecryptedProviderCredential stored = providerTokenService.resolveCredential(AgentProvider.OPENAI);
            baseUrl = stored.baseUrl();
            apiKey = explicitKey.isEmpty() ? stored.apiKey() : explicitKey;
        } catch (ApiException ex) {
            if (explicitKey.isEmpty()) {
                return new OpenAiCostsResponse(
                        false,
                        days,
                        0.0,
                        false,
                        "unavailable",
                        "No OpenAI API token is configured yet. OpenAI also does not provide a remaining credit balance API endpoint."
                );
            }
            apiKey = explicitKey;
        }

        long startTime = Instant.now().minus(days, ChronoUnit.DAYS).getEpochSecond();
        String endpoint = baseUrl + "/organization/costs?start_time=" + startTime + "&bucket_width=1d&limit=" + days;

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401 || response.statusCode() == 403) {
                return new OpenAiCostsResponse(
                        false,
                        days,
                        0.0,
                        false,
                        "unavailable",
                        "OpenAI rejected this key for /v1/organization/costs (HTTP " + response.statusCode()
                                + "). An Organization Admin Key (sk-admin-...) is required for live org spend; remaining credit balance is only visible in the OpenAI Platform Billing dashboard."
                );
            }

            if (response.statusCode() >= 400) {
                return new OpenAiCostsResponse(
                        false,
                        days,
                        0.0,
                        false,
                        "unavailable",
                        "OpenAI Organization Costs API returned HTTP " + response.statusCode() + "."
                );
            }

            double totalSpend = parseTotalCosts(response.body());
            return new OpenAiCostsResponse(
                    true,
                    days,
                    ModelPricingService.roundUsd(totalSpend),
                    false,
                    "openai_organization_costs",
                    "Retrieved billed organization spend for the last " + days
                            + " days from OpenAI (/v1/organization/costs). Note: OpenAI does not expose remaining credit balance via API."
            );
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new OpenAiCostsResponse(false, days, 0.0, false, "unavailable", "OpenAI billing request interrupted.");
        } catch (Exception ex) {
            return new OpenAiCostsResponse(
                    false,
                    days,
                    0.0,
                    false,
                    "unavailable",
                    "Failed to query OpenAI Organization Costs API: " + ex.getMessage()
            );
        }
    }

    private double parseTotalCosts(String jsonBody) throws Exception {
        JsonNode root = objectMapper.readTree(jsonBody);
        double total = 0.0;
        JsonNode data = root.path("data");
        if (data.isArray()) {
            for (JsonNode bucket : data) {
                JsonNode results = bucket.path("results");
                if (results.isArray()) {
                    for (JsonNode result : results) {
                        JsonNode amount = result.path("amount");
                        if (amount.hasNonNull("value")) {
                            total += amount.path("value").asDouble(0.0);
                        }
                    }
                }
            }
        }
        return total;
    }
}

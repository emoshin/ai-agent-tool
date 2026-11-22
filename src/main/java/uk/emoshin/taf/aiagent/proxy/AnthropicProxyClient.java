package uk.emoshin.taf.aiagent.proxy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.service.ProviderTokenService.DecryptedProviderCredential;
import uk.emoshin.taf.aiagent.web.ApiException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Component
public class AnthropicProxyClient implements LlmProxyClient {

    private static final String ANTHROPIC_VERSION = "2023-06-01";
    private static final int DEFAULT_MAX_TOKENS = 4096;
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(120);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public AnthropicProxyClient(ObjectMapper objectMapper) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build(), objectMapper);
    }

    public AnthropicProxyClient(HttpClient httpClient, ObjectMapper objectMapper) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public AgentProvider provider() {
        return AgentProvider.ANTHROPIC;
    }

    @Override
    public LlmCompletionResult streamCompletion(
            DecryptedProviderCredential credential,
            String upstreamModel,
            List<LlmChatMessage> messages,
            Consumer<String> onDelta
    ) {
        return execute(credential, upstreamModel, messages, true, onDelta);
    }

    @Override
    public LlmCompletionResult complete(
            DecryptedProviderCredential credential,
            String upstreamModel,
            List<LlmChatMessage> messages
    ) {
        return execute(credential, upstreamModel, messages, false, delta -> {});
    }

    private LlmCompletionResult execute(
            DecryptedProviderCredential credential,
            String upstreamModel,
            List<LlmChatMessage> messages,
            boolean stream,
            Consumer<String> onDelta
    ) {
        try {
            List<String> systemPrompts = new ArrayList<>();
            List<Map<String, String>> anthropicMessages = new ArrayList<>();

            for (LlmChatMessage msg : messages) {
                if ("system".equalsIgnoreCase(msg.role())) {
                    if (!msg.content().isBlank()) {
                        systemPrompts.add(msg.content());
                    }
                } else {
                    String role = "assistant".equalsIgnoreCase(msg.role()) ? "assistant" : "user";
                    anthropicMessages.add(Map.of("role", role, "content", msg.content()));
                }
            }

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", upstreamModel);
            body.put("max_tokens", DEFAULT_MAX_TOKENS);
            body.put("stream", stream);
            if (!systemPrompts.isEmpty()) {
                body.put("system", String.join("\n\n", systemPrompts));
            }
            body.put("messages", anthropicMessages);

            String jsonBody = objectMapper.writeValueAsString(body);
            String endpoint = credential.baseUrl() + "/messages";

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(REQUEST_TIMEOUT)
                    .header("x-api-key", credential.apiKey())
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8));

            if (stream) {
                reqBuilder.header("Accept", "text/event-stream");
            }

            HttpResponse<InputStream> response = httpClient.send(
                    reqBuilder.build(),
                    HttpResponse.BodyHandlers.ofInputStream()
            );

            if (response.statusCode() >= 400) {
                String errorBody = readAll(response.body());
                throw new ApiException(
                        HttpStatus.BAD_GATEWAY,
                        "Anthropic API returned HTTP " + response.statusCode() + extractErrorDetail(errorBody)
                );
            }

            String contentType = response.headers().firstValue("content-type").orElse("");
            if (!stream || contentType.contains("application/json")) {
                String responseBody = readAll(response.body());
                return parseJsonCompletion(responseBody, onDelta);
            }

            return parseSseStream(response.body(), onDelta);
        } catch (ApiException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Anthropic request was interrupted");
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Failed to reach Anthropic API: " + ex.getMessage());
        }
    }

    private LlmCompletionResult parseJsonCompletion(String responseBody, Consumer<String> onDelta) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        StringBuilder text = new StringBuilder();
        JsonNode contentBlocks = root.path("content");
        if (contentBlocks.isArray()) {
            for (JsonNode block : contentBlocks) {
                if ("text".equals(block.path("type").asText()) || block.has("text")) {
                    text.append(block.path("text").asText(""));
                }
            }
        }
        String resultText = text.toString();
        if (!resultText.isEmpty()) {
            onDelta.accept(resultText);
        }
        long inputTokens = root.path("usage").path("input_tokens").asLong(0L);
        long outputTokens = root.path("usage").path("output_tokens").asLong(0L);
        return new LlmCompletionResult(resultText, inputTokens, outputTokens);
    }

    private LlmCompletionResult parseSseStream(InputStream stream, Consumer<String> onDelta) throws IOException {
        StringBuilder fullContent = new StringBuilder();
        long inputTokens = 0L;
        long outputTokens = 0L;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith(":") || trimmed.startsWith("event:")) {
                    continue;
                }
                if (!trimmed.startsWith("data:")) {
                    continue;
                }
                String data = trimmed.substring(5).trim();
                if (data.isEmpty() || "[DONE]".equals(data)) {
                    continue;
                }

                JsonNode event = objectMapper.readTree(data);
                String type = event.path("type").asText("");
                switch (type) {
                    case "message_start" -> {
                        JsonNode usage = event.path("message").path("usage");
                        if (usage.hasNonNull("input_tokens")) {
                            inputTokens = usage.path("input_tokens").asLong(inputTokens);
                        }
                    }
                    case "content_block_delta" -> {
                        JsonNode deltaNode = event.path("delta");
                        String deltaText = deltaNode.path("text").asText("");
                        if (!deltaText.isEmpty()) {
                            fullContent.append(deltaText);
                            onDelta.accept(deltaText);
                        }
                    }
                    case "message_delta" -> {
                        JsonNode usage = event.path("usage");
                        if (usage.hasNonNull("output_tokens")) {
                            outputTokens = usage.path("output_tokens").asLong(outputTokens);
                        }
                    }
                    case "error" -> {
                        String msg = event.path("error").path("message").asText("Anthropic stream error");
                        throw new ApiException(HttpStatus.BAD_GATEWAY, "Anthropic stream error: " + msg);
                    }
                    default -> {
                        // Ignore ping, content_block_start, content_block_stop, message_stop
                    }
                }
            }
        }

        return new LlmCompletionResult(fullContent.toString(), inputTokens, outputTokens);
    }

    private String extractErrorDetail(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String msg = root.path("error").path("message").asText("");
            if (!msg.isBlank()) {
                return ": " + msg;
            }
        } catch (Exception ignored) {
        }
        return ": " + rawBody.substring(0, Math.min(200, rawBody.length()));
    }

    private static String readAll(InputStream stream) throws IOException {
        try (stream) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}

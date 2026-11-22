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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Component
public class OpenAiProxyClient implements LlmProxyClient {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(120);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public OpenAiProxyClient(ObjectMapper objectMapper) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build(), objectMapper);
    }

    public OpenAiProxyClient(HttpClient httpClient, ObjectMapper objectMapper) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public AgentProvider provider() {
        return AgentProvider.OPENAI;
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
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", upstreamModel);
            body.put("messages", messages.stream()
                    .map(m -> Map.of("role", m.role(), "content", m.content()))
                    .toList());
            body.put("stream", stream);
            if (stream) {
                body.put("stream_options", Map.of("include_usage", true));
            }

            String jsonBody = objectMapper.writeValueAsString(body);
            String endpoint = credential.baseUrl() + "/chat/completions";

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Authorization", "Bearer " + credential.apiKey())
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
                        "OpenAI API returned HTTP " + response.statusCode() + extractErrorDetail(errorBody)
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
            throw new ApiException(HttpStatus.BAD_GATEWAY, "OpenAI request was interrupted");
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Failed to reach OpenAI API: " + ex.getMessage());
        }
    }

    private LlmCompletionResult parseJsonCompletion(String responseBody, Consumer<String> onDelta) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        String text = "";
        JsonNode choices = root.path("choices");
        if (choices.isArray() && !choices.isEmpty()) {
            text = choices.get(0).path("message").path("content").asText("");
        }
        if (!text.isEmpty()) {
            onDelta.accept(text);
        }
        long promptTokens = root.path("usage").path("prompt_tokens").asLong(0L);
        long completionTokens = root.path("usage").path("completion_tokens").asLong(0L);
        return new LlmCompletionResult(text, promptTokens, completionTokens);
    }

    private LlmCompletionResult parseSseStream(InputStream stream, Consumer<String> onDelta) throws IOException {
        StringBuilder fullContent = new StringBuilder();
        long promptTokens = 0L;
        long completionTokens = 0L;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith(":") || !trimmed.startsWith("data:")) {
                    continue;
                }
                String data = trimmed.substring(5).trim();
                if (data.isEmpty() || "[DONE]".equals(data)) {
                    continue;
                }
                JsonNode chunk = objectMapper.readTree(data);
                if (chunk.has("error")) {
                    String errMsg = chunk.path("error").path("message").asText("OpenAI stream error");
                    throw new ApiException(HttpStatus.BAD_GATEWAY, "OpenAI stream error: " + errMsg);
                }
                JsonNode choices = chunk.path("choices");
                if (choices.isArray() && !choices.isEmpty()) {
                    JsonNode deltaNode = choices.get(0).path("delta").path("content");
                    if (!deltaNode.isMissingNode() && !deltaNode.isNull()) {
                        String delta = deltaNode.asText("");
                        if (!delta.isEmpty()) {
                            fullContent.append(delta);
                            onDelta.accept(delta);
                        }
                    }
                }
                JsonNode usage = chunk.path("usage");
                if (usage.isObject()) {
                    if (usage.hasNonNull("prompt_tokens")) {
                        promptTokens = usage.path("prompt_tokens").asLong(promptTokens);
                    }
                    if (usage.hasNonNull("completion_tokens")) {
                        completionTokens = usage.path("completion_tokens").asLong(completionTokens);
                    }
                }
            }
        }
        return new LlmCompletionResult(fullContent.toString(), promptTokens, completionTokens);
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

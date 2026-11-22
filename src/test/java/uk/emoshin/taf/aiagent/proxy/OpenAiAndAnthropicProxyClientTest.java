package uk.emoshin.taf.aiagent.proxy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.proxy.LlmProxyClient.LlmChatMessage;
import uk.emoshin.taf.aiagent.proxy.LlmProxyClient.LlmCompletionResult;
import uk.emoshin.taf.aiagent.service.ProviderTokenService.DecryptedProviderCredential;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class OpenAiAndAnthropicProxyClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void startMockUpstream() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopMockUpstream() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void openAiProxyStreamsDeltasAndExtractsTokenUsage() throws Exception {
        AtomicReference<String> capturedAuthHeader = new AtomicReference<>();
        AtomicReference<String> capturedBody = new AtomicReference<>();

        server.createContext("/v1/chat/completions", exchange -> {
            capturedAuthHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            capturedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));

            String sse = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello \"}}]}\n\n"
                    + "data: {\"choices\":[{\"delta\":{\"content\":\"from ChatGPT!\"}}]}\n\n"
                    + "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":14,\"completion_tokens\":5,\"total_tokens\":19}}\n\n"
                    + "data: [DONE]\n\n";

            byte[] bytes = sse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        OpenAiProxyClient client = new OpenAiProxyClient(objectMapper);
        StringBuilder streamed = new StringBuilder();
        LlmCompletionResult result = client.streamCompletion(
                new DecryptedProviderCredential(AgentProvider.OPENAI, "sk-openai-live-123", baseUrl + "/v1"),
                "gpt-4o",
                List.of(
                        new LlmChatMessage("system", "Be helpful."),
                        new LlmChatMessage("user", "Say hi")
                ),
                streamed::append
        );

        assertThat(capturedAuthHeader.get()).isEqualTo("Bearer sk-openai-live-123");
        JsonNode sentJson = objectMapper.readTree(capturedBody.get());
        assertThat(sentJson.path("model").asText()).isEqualTo("gpt-4o");
        assertThat(sentJson.path("stream").asBoolean()).isTrue();
        assertThat(streamed.toString()).isEqualTo("Hello from ChatGPT!");
        assertThat(result.content()).isEqualTo("Hello from ChatGPT!");
        assertThat(result.promptTokens()).isEqualTo(14L);
        assertThat(result.completionTokens()).isEqualTo(5L);
    }

    @Test
    void anthropicProxySendsApiKeyAndParsesClaudeSseEvents() throws Exception {
        AtomicReference<String> capturedApiKey = new AtomicReference<>();
        AtomicReference<String> capturedVersion = new AtomicReference<>();
        AtomicReference<String> capturedBody = new AtomicReference<>();

        server.createContext("/v1/messages", exchange -> {
            capturedApiKey.set(exchange.getRequestHeaders().getFirst("x-api-key"));
            capturedVersion.set(exchange.getRequestHeaders().getFirst("anthropic-version"));
            capturedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));

            String sse = """
                    event: message_start
                    data: {"type":"message_start","message":{"usage":{"input_tokens":21}}}
                    
                    event: content_block_delta
                    data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello "}}
                    
                    event: content_block_delta
                    data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"from Claude!"}}
                    
                    event: message_delta
                    data: {"type":"message_delta","usage":{"output_tokens":9}}
                    
                    event: message_stop
                    data: {"type":"message_stop"}
                    
                    """;

            byte[] bytes = sse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        AnthropicProxyClient client = new AnthropicProxyClient(objectMapper);
        StringBuilder streamed = new StringBuilder();
        LlmCompletionResult result = client.streamCompletion(
                new DecryptedProviderCredential(AgentProvider.ANTHROPIC, "sk-ant-live-456", baseUrl + "/v1"),
                "claude-sonnet-4-20250514",
                List.of(
                        new LlmChatMessage("system", "Answer concisely."),
                        new LlmChatMessage("user", "Say hi")
                ),
                streamed::append
        );

        assertThat(capturedApiKey.get()).isEqualTo("sk-ant-live-456");
        assertThat(capturedVersion.get()).isEqualTo("2023-06-01");
        JsonNode sentJson = objectMapper.readTree(capturedBody.get());
        assertThat(sentJson.path("model").asText()).isEqualTo("claude-sonnet-4-20250514");
        assertThat(sentJson.path("system").asText()).isEqualTo("Answer concisely.");
        assertThat(sentJson.path("messages").size()).isEqualTo(1);
        assertThat(sentJson.path("messages").get(0).path("role").asText()).isEqualTo("user");

        assertThat(streamed.toString()).isEqualTo("Hello from Claude!");
        assertThat(result.content()).isEqualTo("Hello from Claude!");
        assertThat(result.promptTokens()).isEqualTo(21L);
        assertThat(result.completionTokens()).isEqualTo(9L);
    }
}

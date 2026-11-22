package uk.emoshin.taf.aiagent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.domain.ProviderToken;
import uk.emoshin.taf.aiagent.domain.UserStatus;
import uk.emoshin.taf.aiagent.dto.AdminDtos.AdminUserDto;
import uk.emoshin.taf.aiagent.dto.AdminDtos.GlobalTokenStatsResponse;
import uk.emoshin.taf.aiagent.dto.AdminDtos.OpenAiCostsRequest;
import uk.emoshin.taf.aiagent.dto.AdminDtos.OpenAiCostsResponse;
import uk.emoshin.taf.aiagent.dto.AdminDtos.ProviderTokenResponse;
import uk.emoshin.taf.aiagent.dto.AdminDtos.UpdateUserStatusRequest;
import uk.emoshin.taf.aiagent.dto.AdminDtos.UpsertProviderTokenRequest;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatMessageInput;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatRequest;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatSessionResponse;
import uk.emoshin.taf.aiagent.dto.UserDtos.AuthResponse;
import uk.emoshin.taf.aiagent.dto.UserDtos.LoginRequest;
import uk.emoshin.taf.aiagent.dto.UserDtos.ModelUsageDto;
import uk.emoshin.taf.aiagent.dto.UserDtos.RegisterRequest;
import uk.emoshin.taf.aiagent.dto.UserDtos.UpdateProfileRequest;
import uk.emoshin.taf.aiagent.dto.UserDtos.UserProfileResponse;
import uk.emoshin.taf.aiagent.repository.ProviderTokenRepository;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class BackendIntegrationTest {

    private static HttpServer mockLlmServer;
    private static String mockBaseUrl;
    private static final AtomicReference<String> LAST_OPENAI_AUTH = new AtomicReference<>();
    private static final AtomicReference<String> LAST_ANTHROPIC_KEY = new AtomicReference<>();
    private static final AtomicReference<String> LAST_ANTHROPIC_MODEL = new AtomicReference<>();

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProviderTokenRepository providerTokenRepository;

    @BeforeAll
    static void startMockProviders() throws IOException {
        mockLlmServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);

        mockLlmServer.createContext("/openai/v1/chat/completions", exchange -> {
            LAST_OPENAI_AUTH.set(exchange.getRequestHeaders().getFirst("Authorization"));
            String reqBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            boolean stream = reqBody.contains("\"stream\":true");

            if (stream) {
                String sse = ""
                        + "data: {\"choices\":[{\"delta\":{\"content\":\"OpenAI \"}}]}\n\n"
                        + "data: {\"choices\":[{\"delta\":{\"content\":\"reply\"}}]}\n\n"
                        + "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":4,\"total_tokens\":14}}\n\n"
                        + "data: [DONE]\n\n";
                byte[] bytes = sse.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            } else {
                String json = "{\"choices\":[{\"message\":{\"content\":\"OpenAI sync reply\"}}],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":4}}";
                byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });

        mockLlmServer.createContext("/openai/v1/organization/costs", exchange -> {
            String auth = exchange.getRequestHeaders().getFirst("Authorization");
            if (!"Bearer sk-admin-test-key".equals(auth)) {
                byte[] err = "{\"error\":{\"message\":\"Admin key required\"}}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(403, err.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(err);
                }
                return;
            }
            String json = "{\"data\":[{\"results\":[{\"amount\":{\"value\":12.345,\"currency\":\"usd\"}}]}]}";
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        mockLlmServer.createContext("/anthropic/v1/messages", exchange -> {
            LAST_ANTHROPIC_KEY.set(exchange.getRequestHeaders().getFirst("x-api-key"));
            String reqBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            try {
                JsonNode node = new ObjectMapper().readTree(reqBody);
                LAST_ANTHROPIC_MODEL.set(node.path("model").asText());
            } catch (Exception ignored) {
            }

            String json = "{\"content\":[{\"type\":\"text\",\"text\":\"Claude reply\"}],\"usage\":{\"input_tokens\":18,\"output_tokens\":7}}";
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        mockLlmServer.start();
        mockBaseUrl = "http://127.0.0.1:" + mockLlmServer.getAddress().getPort();
    }

    @AfterAll
    static void stopMockProviders() {
        if (mockLlmServer != null) {
            mockLlmServer.stop(0);
        }
    }

    @Test
    void fullWorkflowRegistrationProfileAdminTokensProxyAndStats() throws Exception {
        // 1. Register a regular user
        ResponseEntity<AuthResponse> registerRes = restTemplate.postForEntity(
                "/api/users/register",
                new RegisterRequest("Alice Tester", "alice@example.com", "secret123", "Engineer", null),
                AuthResponse.class
        );
        assertThat(registerRes.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(registerRes.getBody()).isNotNull();
        String aliceJwt = registerRes.getBody().accessToken();
        assertThat(aliceJwt).isNotBlank();
        assertThat(registerRes.getBody().user().email()).isEqualTo("alice@example.com");

        // Duplicate registration fails with 409
        ResponseEntity<String> dupRes = restTemplate.postForEntity(
                "/api/users/register",
                new RegisterRequest("Alice 2", "alice@example.com", "secret123", null, null),
                String.class
        );
        assertThat(dupRes.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // 2. Regular user updates personal profile data & password
        ResponseEntity<UserProfileResponse> updateRes = restTemplate.exchange(
                "/api/users/me",
                HttpMethod.PUT,
                new HttpEntity<>(
                        new UpdateProfileRequest("Alice Updated", "Staff Engineer", "https://img.test/a.png", "newpass456"),
                        bearerHeaders(aliceJwt)
                ),
                UserProfileResponse.class
        );
        assertThat(updateRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updateRes.getBody().name()).isEqualTo("Alice Updated");
        assertThat(updateRes.getBody().subtitle()).isEqualTo("Staff Engineer");
        assertThat(updateRes.getBody().avatarUrl()).isEqualTo("https://img.test/a.png");

        // Verify login works with updated password
        ResponseEntity<AuthResponse> reloginRes = restTemplate.postForEntity(
                "/api/users/login",
                new LoginRequest("alice@example.com", "newpass456"),
                AuthResponse.class
        );
        assertThat(reloginRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        aliceJwt = reloginRes.getBody().accessToken();

        // 3. Regular user MUST NOT access any admin endpoints or view provider tokens
        ResponseEntity<String> forbiddenTokensGet = restTemplate.exchange(
                "/api/admin/provider-tokens",
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(aliceJwt)),
                String.class
        );
        assertThat(forbiddenTokensGet.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        ResponseEntity<String> forbiddenTokenPost = restTemplate.exchange(
                "/api/admin/provider-tokens",
                HttpMethod.POST,
                new HttpEntity<>(
                        new UpsertProviderTokenRequest("openai", "sk-hack", null),
                        bearerHeaders(aliceJwt)
                ),
                String.class
        );
        assertThat(forbiddenTokenPost.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // Calling /api/chat before admin sets tokens returns 503 Service Unavailable
        ResponseEntity<String> missingTokenChat = restTemplate.exchange(
                "/api/chat",
                HttpMethod.POST,
                new HttpEntity<>(
                        new ChatRequest(null, "gpt-4o", false, List.of(new ChatMessageInput("user", "Hello"))),
                        bearerHeaders(aliceJwt)
                ),
                String.class
        );
        assertThat(missingTokenChat.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);

        // 4. Admin logs in and configures OpenAI & Anthropic API tokens
        ResponseEntity<AuthResponse> adminLogin = restTemplate.postForEntity(
                "/api/users/login",
                new LoginRequest("admin@ai-agent-tool.dev", "admin123"),
                AuthResponse.class
        );
        assertThat(adminLogin.getStatusCode()).isEqualTo(HttpStatus.OK);
        String adminJwt = adminLogin.getBody().accessToken();

        String rawOpenAiKey = "sk-proj-openai-secret-9999";
        String rawAnthropicKey = "sk-ant-api03-secret-8888";

        ResponseEntity<ProviderTokenResponse> openAiSave = restTemplate.exchange(
                "/api/admin/provider-tokens",
                HttpMethod.POST,
                new HttpEntity<>(
                        new UpsertProviderTokenRequest("openai", rawOpenAiKey, mockBaseUrl + "/openai/v1"),
                        bearerHeaders(adminJwt)
                ),
                ProviderTokenResponse.class
        );
        assertThat(openAiSave.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(openAiSave.getBody().configured()).isTrue();
        assertThat(openAiSave.getBody().maskedKey()).isEqualTo("sk-pr••••••9999");
        assertThat(openAiSave.getBody().maskedKey()).doesNotContain("openai-secret");

        ResponseEntity<ProviderTokenResponse> anthropicSave = restTemplate.exchange(
                "/api/admin/provider-tokens",
                HttpMethod.POST,
                new HttpEntity<>(
                        new UpsertProviderTokenRequest("anthropic", rawAnthropicKey, mockBaseUrl + "/anthropic/v1"),
                        bearerHeaders(adminJwt)
                ),
                ProviderTokenResponse.class
        );
        assertThat(anthropicSave.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(anthropicSave.getBody().maskedKey()).isEqualTo("sk-an••••••8888");

        // Verify stored DB token is encrypted, never plaintext
        ProviderToken storedOpenAi = providerTokenRepository.findById(AgentProvider.OPENAI).orElseThrow();
        assertThat(storedOpenAi.getEncryptedApiKey()).isNotEqualTo(rawOpenAiKey);
        assertThat(storedOpenAi.getEncryptedApiKey()).doesNotContain(rawOpenAiKey);

        // 5. Regular user chats with ChatGPT (gpt-4o, SSE streaming) -> backend injects admin's OpenAI token
        ResponseEntity<String> sseResponse = restTemplate.exchange(
                "/api/chat",
                HttpMethod.POST,
                new HttpEntity<>(
                        new ChatRequest(
                                "chat-alice-1",
                                "gpt-4o",
                                true,
                                List.of(new ChatMessageInput("user", "Hello ChatGPT"))
                        ),
                        bearerHeaders(aliceJwt)
                ),
                String.class
        );
        assertThat(sseResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(sseResponse.getBody()).contains("OpenAI ");
        assertThat(sseResponse.getBody()).contains("reply");
        assertThat(sseResponse.getBody()).contains("[DONE]");
        assertThat(sseResponse.getBody()).doesNotContain(rawOpenAiKey);
        assertThat(LAST_OPENAI_AUTH.get()).isEqualTo("Bearer " + rawOpenAiKey);

        // 6. Model lock check: trying to switch model on the same chatId returns 409 Conflict
        ResponseEntity<String> modelSwitchAttempt = restTemplate.exchange(
                "/api/chat",
                HttpMethod.POST,
                new HttpEntity<>(
                        new ChatRequest(
                                "chat-alice-1",
                                "claude-sonnet-4",
                                false,
                                List.of(new ChatMessageInput("user", "Switch model please"))
                        ),
                        bearerHeaders(aliceJwt)
                ),
                String.class
        );
        assertThat(modelSwitchAttempt.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // 7. Regular user starts a new chat with Claude (claude-sonnet-4) -> backend injects admin's Anthropic key
        ResponseEntity<String> claudeResponse = restTemplate.exchange(
                "/api/chat",
                HttpMethod.POST,
                new HttpEntity<>(
                        new ChatRequest(
                                "chat-alice-2",
                                "claude-sonnet-4",
                                false,
                                List.of(
                                        new ChatMessageInput("system", "Stay concise"),
                                        new ChatMessageInput("user", "Hello Claude")
                                )
                        ),
                        bearerHeaders(aliceJwt)
                ),
                String.class
        );
        assertThat(claudeResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(claudeResponse.getBody()).contains("Claude reply");
        assertThat(claudeResponse.getBody()).doesNotContain(rawAnthropicKey);
        assertThat(LAST_ANTHROPIC_KEY.get()).isEqualTo(rawAnthropicKey);
        assertThat(LAST_ANTHROPIC_MODEL.get()).isEqualTo("claude-sonnet-4-20250514");

        // 8. Verify per-model token usage statistics for Alice & Global Admin stats
        ResponseEntity<UserProfileResponse> aliceMe = restTemplate.exchange(
                "/api/users/me",
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(aliceJwt)),
                UserProfileResponse.class
        );
        assertThat(aliceMe.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(aliceMe.getBody().tokenUsage().totalTokens()).isEqualTo(14L + 25L);
        assertThat(aliceMe.getBody().tokenUsage().estimatedCostUsd()).isCloseTo(0.000224, within(1e-7));

        Map<String, ModelUsageDto> byModel = aliceMe.getBody().modelBreakdown().stream()
                .collect(java.util.stream.Collectors.toMap(ModelUsageDto::model, m -> m));
        assertThat(byModel).containsKeys("gpt-4o", "claude-sonnet-4");
        assertThat(byModel.get("gpt-4o").provider()).isEqualTo(AgentProvider.OPENAI);
        assertThat(byModel.get("gpt-4o").totalTokens()).isEqualTo(14L);
        assertThat(byModel.get("gpt-4o").estimatedCostUsd()).isCloseTo(0.000065, within(1e-7));
        assertThat(byModel.get("claude-sonnet-4").provider()).isEqualTo(AgentProvider.ANTHROPIC);
        assertThat(byModel.get("claude-sonnet-4").totalTokens()).isEqualTo(25L);
        assertThat(byModel.get("claude-sonnet-4").estimatedCostUsd()).isCloseTo(0.000159, within(1e-7));

        ResponseEntity<GlobalTokenStatsResponse> globalStats = restTemplate.exchange(
                "/api/admin/stats/tokens",
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(adminJwt)),
                GlobalTokenStatsResponse.class
        );
        assertThat(globalStats.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(globalStats.getBody().totalTokens()).isEqualTo(39L);
        assertThat(globalStats.getBody().openAiEstimatedCostUsd()).isCloseTo(0.000065, within(1e-7));
        assertThat(globalStats.getBody().anthropicEstimatedCostUsd()).isCloseTo(0.000159, within(1e-7));
        assertThat(globalStats.getBody().estimatedCostUsd()).isCloseTo(0.000224, within(1e-7));

        // 8b. OpenAI organization costs endpoint: forbidden to regular user, graceful with project key, works with admin key
        ResponseEntity<String> forbiddenBilling = restTemplate.exchange(
                "/api/admin/billing/openai-costs",
                HttpMethod.POST,
                new HttpEntity<>(new OpenAiCostsRequest(null, 30), bearerHeaders(aliceJwt)),
                String.class
        );
        assertThat(forbiddenBilling.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        ResponseEntity<OpenAiCostsResponse> projectKeyBilling = restTemplate.exchange(
                "/api/admin/billing/openai-costs",
                HttpMethod.POST,
                new HttpEntity<>(new OpenAiCostsRequest(null, 30), bearerHeaders(adminJwt)),
                OpenAiCostsResponse.class
        );
        assertThat(projectKeyBilling.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(projectKeyBilling.getBody().available()).isFalse();
        assertThat(projectKeyBilling.getBody().remainingBalanceSupported()).isFalse();
        assertThat(projectKeyBilling.getBody().message()).contains("sk-admin-");

        ResponseEntity<OpenAiCostsResponse> adminKeyBilling = restTemplate.exchange(
                "/api/admin/billing/openai-costs",
                HttpMethod.POST,
                new HttpEntity<>(new OpenAiCostsRequest("sk-admin-test-key", 30), bearerHeaders(adminJwt)),
                OpenAiCostsResponse.class
        );
        assertThat(adminKeyBilling.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(adminKeyBilling.getBody().available()).isTrue();
        assertThat(adminKeyBilling.getBody().periodDays()).isEqualTo(30);
        assertThat(adminKeyBilling.getBody().totalSpendUsd()).isCloseTo(12.345, within(1e-6));
        assertThat(adminKeyBilling.getBody().remainingBalanceSupported()).isFalse();
        assertThat(adminKeyBilling.getBody().source()).isEqualTo("openai_organization_costs");

        // Admin inspects Alice's chats
        ResponseEntity<AdminUserDto[]> usersRes = restTemplate.exchange(
                "/api/admin/users",
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(adminJwt)),
                AdminUserDto[].class
        );
        AdminUserDto aliceAdminView = List.of(usersRes.getBody()).stream()
                .filter(u -> u.email().equals("alice@example.com"))
                .findFirst()
                .orElseThrow();
        assertThat(aliceAdminView.chatCount()).isEqualTo(2L);
        assertThat(aliceAdminView.tokenUsage().estimatedCostUsd()).isCloseTo(0.000224, within(1e-7));

        ResponseEntity<ChatSessionResponse[]> aliceChats = restTemplate.exchange(
                "/api/admin/users/" + aliceAdminView.id() + "/chats",
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(adminJwt)),
                ChatSessionResponse[].class
        );
        assertThat(aliceChats.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(aliceChats.getBody()).hasSize(2);

        // 9. Admin suspends Alice -> Alice cannot login or chat
        ResponseEntity<AdminUserDto> suspendRes = restTemplate.exchange(
                "/api/admin/users/" + aliceAdminView.id() + "/status",
                HttpMethod.PATCH,
                new HttpEntity<>(new UpdateUserStatusRequest(UserStatus.SUSPENDED), bearerHeaders(adminJwt)),
                AdminUserDto.class
        );
        assertThat(suspendRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(suspendRes.getBody().status()).isEqualTo(UserStatus.SUSPENDED);

        ResponseEntity<String> suspendedChatAttempt = restTemplate.exchange(
                "/api/chat",
                HttpMethod.POST,
                new HttpEntity<>(
                        new ChatRequest(null, "gpt-4o", false, List.of(new ChatMessageInput("user", "Am I blocked?"))),
                        bearerHeaders(aliceJwt)
                ),
                String.class
        );
        assertThat(suspendedChatAttempt.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        ResponseEntity<String> suspendedLoginAttempt = restTemplate.postForEntity(
                "/api/users/login",
                new LoginRequest("alice@example.com", "newpass456"),
                String.class
        );
        assertThat(suspendedLoginAttempt.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    private static HttpHeaders bearerHeaders(String jwt) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(jwt);
        return headers;
    }
}

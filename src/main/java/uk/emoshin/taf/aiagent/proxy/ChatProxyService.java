package uk.emoshin.taf.aiagent.proxy;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.domain.AppUser;
import uk.emoshin.taf.aiagent.domain.ChatMessageEntity;
import uk.emoshin.taf.aiagent.domain.ChatSessionEntity;
import uk.emoshin.taf.aiagent.domain.UserStatus;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatMessageInput;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatRequest;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatSessionResponse;
import uk.emoshin.taf.aiagent.dto.UserDtos.TokenUsageSummaryDto;
import uk.emoshin.taf.aiagent.proxy.LlmProxyClient.LlmChatMessage;
import uk.emoshin.taf.aiagent.proxy.LlmProxyClient.LlmCompletionResult;
import uk.emoshin.taf.aiagent.repository.AppUserRepository;
import uk.emoshin.taf.aiagent.repository.ChatSessionRepository;
import uk.emoshin.taf.aiagent.service.AdminService;
import uk.emoshin.taf.aiagent.service.ModelRoutingHelper;
import uk.emoshin.taf.aiagent.service.ProviderTokenService;
import uk.emoshin.taf.aiagent.service.ProviderTokenService.DecryptedProviderCredential;
import uk.emoshin.taf.aiagent.service.TokenStatsService;
import uk.emoshin.taf.aiagent.web.ApiException;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ChatProxyService {

    public record ChatCompletionResponse(
            UUID chatId,
            String model,
            String provider,
            String content,
            long promptTokens,
            long completionTokens,
            long totalTokens
    ) {
    }

    private record PreparedChatTurn(
            UUID userId,
            UUID chatSessionId,
            String selectedModel,
            String upstreamModel,
            AgentProvider provider,
            DecryptedProviderCredential credential,
            List<LlmChatMessage> messagesToSend
    ) {
    }

    private final AppUserRepository appUserRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final ProviderTokenService providerTokenService;
    private final TokenStatsService tokenStatsService;
    private final ModelRoutingHelper modelRoutingHelper;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;
    private final Map<AgentProvider, LlmProxyClient> proxyClients;

    public ChatProxyService(
            AppUserRepository appUserRepository,
            ChatSessionRepository chatSessionRepository,
            ProviderTokenService providerTokenService,
            TokenStatsService tokenStatsService,
            ModelRoutingHelper modelRoutingHelper,
            TransactionTemplate transactionTemplate,
            ObjectMapper objectMapper,
            List<LlmProxyClient> clients
    ) {
        this.appUserRepository = appUserRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.providerTokenService = providerTokenService;
        this.tokenStatsService = tokenStatsService;
        this.modelRoutingHelper = modelRoutingHelper;
        this.transactionTemplate = transactionTemplate;
        this.objectMapper = objectMapper;
        this.proxyClients = new EnumMap<>(AgentProvider.class);
        this.proxyClients.putAll(
                clients.stream().collect(Collectors.toMap(LlmProxyClient::provider, Function.identity()))
        );
    }

    public SseEmitter streamChat(UUID userId, ChatRequest request) {
        PreparedChatTurn turn = prepareTurn(userId, request);
        SseEmitter emitter = new SseEmitter(180_000L);

        CompletableFuture.runAsync(() -> {
            try {
                LlmProxyClient client = resolveClient(turn.provider());
                LlmCompletionResult result = client.streamCompletion(
                        turn.credential(),
                        turn.upstreamModel(),
                        turn.messagesToSend(),
                        delta -> sendSseDelta(emitter, delta)
                );

                persistAssistantTurn(turn, result);

                emitter.send(SseEmitter.event().data("[DONE]"));
                emitter.complete();
            } catch (Exception ex) {
                try {
                    String safeMessage = ex.getMessage() != null ? ex.getMessage() : "Upstream proxy error";
                    String errorPayload = objectMapper.writeValueAsString(Map.of("error", safeMessage));
                    emitter.send(SseEmitter.event().data(errorPayload));
                } catch (Exception ignored) {
                }
                emitter.completeWithError(ex);
            }
        });

        return emitter;
    }

    public ChatCompletionResponse completeChat(UUID userId, ChatRequest request) {
        PreparedChatTurn turn = prepareTurn(userId, request);
        LlmProxyClient client = resolveClient(turn.provider());
        LlmCompletionResult result = client.complete(
                turn.credential(),
                turn.upstreamModel(),
                turn.messagesToSend()
        );
        LlmCompletionResult finalUsage = persistAssistantTurn(turn, result);
        return new ChatCompletionResponse(
                turn.chatSessionId(),
                turn.selectedModel(),
                turn.provider().toCode(),
                result.content(),
                finalUsage.promptTokens(),
                finalUsage.completionTokens(),
                finalUsage.promptTokens() + finalUsage.completionTokens()
        );
    }

    public List<ChatSessionResponse> listUserChats(UUID userId) {
        return transactionTemplate.execute(status ->
                chatSessionRepository.findByUserIdAndDeletedFalseOrderByUpdatedAtDesc(userId).stream()
                        .map(AdminService::toChatSessionResponse)
                        .toList()
        );
    }

    public ChatSessionResponse renameUserChat(UUID userId, UUID chatId, String newTitle) {
        return transactionTemplate.execute(status -> {
            ChatSessionEntity session = chatSessionRepository.findByIdAndUserId(chatId, userId)
                    .filter(chat -> !chat.isDeleted())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Chat session not found"));
            session.setTitle(newTitle.trim());
            session.setUpdatedAt(Instant.now().toEpochMilli());
            return AdminService.toChatSessionResponse(chatSessionRepository.save(session));
        });
    }

    public void deleteUserChat(UUID userId, UUID chatId) {
        transactionTemplate.executeWithoutResult(status -> {
            ChatSessionEntity session = chatSessionRepository.findByIdAndUserId(chatId, userId)
                    .filter(chat -> !chat.isDeleted())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Chat session not found"));
            long now = Instant.now().toEpochMilli();
            session.setDeleted(true);
            session.setDeletedAt(now);
            session.setUpdatedAt(now);
            chatSessionRepository.save(session);
        });
    }

    private PreparedChatTurn prepareTurn(UUID userId, ChatRequest request) {
        String selectedModel = request.model().trim();
        AgentProvider provider = modelRoutingHelper.resolveProvider(selectedModel);
        String upstreamModel = modelRoutingHelper.resolveUpstreamModel(selectedModel);
        DecryptedProviderCredential credential = providerTokenService.resolveCredential(provider);

        return transactionTemplate.execute(status -> {
            AppUser user = appUserRepository.findById(userId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));

            if (user.getStatus() == UserStatus.SUSPENDED) {
                throw new ApiException(HttpStatus.FORBIDDEN, "User account is suspended");
            }

            TokenUsageSummaryDto usage = tokenStatsService.getUserTokenSummary(user.getId(), user.getTokenLimit());
            if (usage.totalTokens() >= usage.tokenLimit()) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "User token quota exceeded");
            }

            long now = Instant.now().toEpochMilli();
            user.setLastActiveAt(now);
            appUserRepository.save(user);

            ChatSessionEntity session = resolveOrCreateSession(user, request.chatId(), selectedModel, provider, now, request.messages());

            // Persist the latest user message in the conversation
            ChatMessageInput latestUserInput = findLatestUserInput(request.messages());
            if (latestUserInput != null) {
                ChatMessageEntity userMsg = new ChatMessageEntity();
                userMsg.setId(UUID.randomUUID());
                userMsg.setChatSession(session);
                userMsg.setRole("user");
                userMsg.setContent(latestUserInput.content());
                userMsg.setTokenCount(modelRoutingHelper.estimateTokens(latestUserInput.content()));
                userMsg.setCreatedAt(now);
                session.getMessages().add(userMsg);
                session.setUpdatedAt(now);
                chatSessionRepository.save(session);
            }

            List<LlmChatMessage> messagesToSend = request.messages().stream()
                    .map(m -> new LlmChatMessage(normalizeRole(m.role()), m.content()))
                    .toList();

            return new PreparedChatTurn(
                    user.getId(),
                    session.getId(),
                    session.getModel(),
                    upstreamModel,
                    provider,
                    credential,
                    messagesToSend
            );
        });
    }

    private LlmCompletionResult persistAssistantTurn(PreparedChatTurn turn, LlmCompletionResult rawResult) {
        long promptTokens = rawResult.promptTokens() > 0
                ? rawResult.promptTokens()
                : turn.messagesToSend().stream()
                .mapToLong(m -> modelRoutingHelper.estimateTokens(m.content()))
                .sum();
        long completionTokens = rawResult.completionTokens() > 0
                ? rawResult.completionTokens()
                : modelRoutingHelper.estimateTokens(rawResult.content());

        transactionTemplate.executeWithoutResult(status -> {
            AppUser user = appUserRepository.findById(turn.userId()).orElseThrow();
            ChatSessionEntity session = chatSessionRepository.findById(turn.chatSessionId()).orElseThrow();
            long now = Instant.now().toEpochMilli();

            ChatMessageEntity assistantMsg = new ChatMessageEntity();
            assistantMsg.setId(UUID.randomUUID());
            assistantMsg.setChatSession(session);
            assistantMsg.setRole("assistant");
            assistantMsg.setContent(rawResult.content());
            assistantMsg.setTokenCount((int) completionTokens);
            assistantMsg.setCreatedAt(now);
            session.getMessages().add(assistantMsg);
            session.setUpdatedAt(now);
            chatSessionRepository.save(session);

            tokenStatsService.recordUsage(
                    user,
                    session.getId(),
                    turn.selectedModel(),
                    turn.provider(),
                    promptTokens,
                    completionTokens
            );
        });

        return new LlmCompletionResult(rawResult.content(), promptTokens, completionTokens);
    }

    private ChatSessionEntity resolveOrCreateSession(
            AppUser user,
            String requestedChatIdRaw,
            String selectedModel,
            AgentProvider provider,
            long now,
            List<ChatMessageInput> incomingMessages
    ) {
        UUID requestedChatId = resolveChatUuid(user.getId(), requestedChatIdRaw);
        if (requestedChatId != null) {
            ChatSessionEntity existing = chatSessionRepository.findById(requestedChatId).orElse(null);
            if (existing != null) {
                if (!existing.getUser().getId().equals(user.getId())) {
                    throw new ApiException(HttpStatus.FORBIDDEN, "Chat session belongs to another user");
                }
                if (existing.isDeleted()) {
                    throw new ApiException(HttpStatus.GONE, "Chat session has been deleted");
                }
                if (!existing.getMessages().isEmpty() && !existing.getModel().equalsIgnoreCase(selectedModel)) {
                    throw new ApiException(
                            HttpStatus.CONFLICT,
                            "Model is locked to '" + existing.getModel() + "' for this conversation"
                    );
                }
                if (existing.getMessages().isEmpty()) {
                    existing.setModel(selectedModel);
                    existing.setProvider(provider);
                }
                return existing;
            }
        }

        ChatSessionEntity created = new ChatSessionEntity();
        created.setId(requestedChatId != null ? requestedChatId : UUID.randomUUID());
        created.setUser(user);
        created.setTitle(deriveChatTitle(incomingMessages));
        created.setModel(selectedModel);
        created.setProvider(provider);
        created.setCreatedAt(now);
        created.setUpdatedAt(now);
        return chatSessionRepository.save(created);
    }

    private static UUID resolveChatUuid(UUID userId, String rawChatId) {
        if (rawChatId == null || rawChatId.isBlank()) {
            return null;
        }
        String trimmed = rawChatId.trim();
        try {
            return UUID.fromString(trimmed);
        } catch (IllegalArgumentException ignored) {
        }
        if (trimmed.startsWith("chat-")) {
            try {
                return UUID.fromString(trimmed.substring(5));
            } catch (IllegalArgumentException ignored) {
            }
        }
        return UUID.nameUUIDFromBytes((userId + ":" + trimmed).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private LlmProxyClient resolveClient(AgentProvider provider) {
        LlmProxyClient client = proxyClients.get(provider);
        if (client == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No proxy client registered for " + provider);
        }
        return client;
    }

    private void sendSseDelta(SseEmitter emitter, String delta) {
        try {
            String json = objectMapper.writeValueAsString(Map.of("delta", delta));
            emitter.send(SseEmitter.event().data(json));
        } catch (Exception ex) {
            throw new RuntimeException("Client SSE connection closed", ex);
        }
    }

    private static ChatMessageInput findLatestUserInput(List<ChatMessageInput> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            if ("user".equalsIgnoreCase(messages.get(i).role())) {
                return messages.get(i);
            }
        }
        return null;
    }

    private static String deriveChatTitle(List<ChatMessageInput> messages) {
        for (ChatMessageInput msg : messages) {
            if ("user".equalsIgnoreCase(msg.role()) && !msg.content().isBlank()) {
                String singleLine = msg.content().trim().replaceAll("\\s+", " ");
                return singleLine.length() > 64 ? singleLine.substring(0, 61) + "..." : singleLine;
            }
        }
        return "New Chat";
    }

    private static String normalizeRole(String role) {
        if (role == null) {
            return "user";
        }
        return switch (role.trim().toLowerCase()) {
            case "system" -> "system";
            case "assistant" -> "assistant";
            default -> "user";
        };
    }
}

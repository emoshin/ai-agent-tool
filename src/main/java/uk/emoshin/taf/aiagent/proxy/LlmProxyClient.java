package uk.emoshin.taf.aiagent.proxy;

import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.service.ProviderTokenService.DecryptedProviderCredential;

import java.util.List;
import java.util.function.Consumer;

public interface LlmProxyClient {

    record LlmChatMessage(String role, String content) {
    }

    record LlmCompletionResult(
            String content,
            long promptTokens,
            long completionTokens
    ) {
    }

    AgentProvider provider();

    LlmCompletionResult streamCompletion(
            DecryptedProviderCredential credential,
            String upstreamModel,
            List<LlmChatMessage> messages,
            Consumer<String> onDelta
    );

    LlmCompletionResult complete(
            DecryptedProviderCredential credential,
            String upstreamModel,
            List<LlmChatMessage> messages
    );
}

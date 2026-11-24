package uk.emoshin.taf.aiagent.service;

import org.springframework.stereotype.Component;
import uk.emoshin.taf.aiagent.domain.AgentProvider;

import java.util.Locale;

@Component
public class ModelRoutingHelper {

    public AgentProvider resolveProvider(String model) {
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException("Model must not be blank");
        }
        String lower = model.trim().toLowerCase(Locale.ROOT);
        if (lower.contains("claude") || lower.contains("anthropic")) {
            return AgentProvider.ANTHROPIC;
        }
        if (lower.contains("gpt")
                || lower.contains("chatgpt")
                || lower.contains("openai")
                || lower.matches("^o[134](-.*|$)")
                || "agent-4o".equals(lower)
                || "agent-o3-mini".equals(lower)) {
            return AgentProvider.OPENAI;
        }
        throw new IllegalArgumentException("Unsupported model for provider routing: " + model);
    }

    public String resolveUpstreamModel(String model) {
        if (model == null) {
            return "";
        }
        String trimmed = model.trim();
        return switch (trimmed.toLowerCase(Locale.ROOT)) {
            case "agent-4o" -> "gpt-4o";
            case "agent-o3-mini" -> "o3-mini";
            case "claude-sonnet-4" -> "claude-sonnet-4-20250514";
            case "claude-opus-4" -> "claude-opus-4-20250514";
            case "claude-3-5-haiku", "claude-haiku" -> "claude-3-5-haiku-latest";
            default -> trimmed;
        };
    }

    public int estimateTokens(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return Math.max(1, (int) Math.ceil(text.trim().length() / 4.0));
    }
}

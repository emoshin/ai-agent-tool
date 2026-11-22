package uk.emoshin.taf.aiagent.domain;

import java.util.Locale;

public enum AgentProvider {
    OPENAI("ChatGPT (OpenAI)", "https://api.openai.com/v1"),
    ANTHROPIC("Claude (Anthropic)", "https://api.anthropic.com/v1");

    private final String displayLabel;
    private final String defaultBaseUrl;

    AgentProvider(String displayLabel, String defaultBaseUrl) {
        this.displayLabel = displayLabel;
        this.defaultBaseUrl = defaultBaseUrl;
    }

    public String getDisplayLabel() {
        return displayLabel;
    }

    public String getDefaultBaseUrl() {
        return defaultBaseUrl;
    }

    public static AgentProvider fromCode(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Provider must not be blank");
        }
        return switch (code.trim().toLowerCase(Locale.ROOT)) {
            case "openai", "chatgpt" -> OPENAI;
            case "anthropic", "claude" -> ANTHROPIC;
            default -> throw new IllegalArgumentException("Unsupported provider: " + code);
        };
    }

    public String toCode() {
        return name().toLowerCase(Locale.ROOT);
    }
}

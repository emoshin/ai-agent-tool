import type { ManagedUser } from '../types/admin';
import type { ChatMessage, ChatSession } from '../types/chat';
import { getModelProvider } from './defaults';

export interface ModelPricingRate {
  modelPattern: string;
  label: string;
  provider: 'openai' | 'anthropic';
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export const MODEL_PRICING_LIST: ModelPricingRate[] = [
  {
    modelPattern: 'gpt-6.2-sol',
    label: 'ChatGPT 6.2 Sol',
    provider: 'openai',
    inputUsdPerMillion: 2.5,
    outputUsdPerMillion: 10.0,
  },
  {
    modelPattern: 'gpt-5-nano',
    label: 'GPT-5 Nano',
    provider: 'openai',
    inputUsdPerMillion: 0.05,
    outputUsdPerMillion: 0.4,
  },
  {
    modelPattern: 'claude-opus-5-5',
    label: 'Claude Opus 5.5',
    provider: 'anthropic',
    inputUsdPerMillion: 15.0,
    outputUsdPerMillion: 75.0,
  },
  {
    modelPattern: 'claude-3-5-haiku',
    label: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    inputUsdPerMillion: 0.8,
    outputUsdPerMillion: 4.0,
  },
];

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function getMessageTokens(message: ChatMessage): number {
  if (typeof message.tokenCount === 'number') {
    return message.tokenCount;
  }
  return estimateTokens(message.content);
}

export function computeChatTokenBreakdown(chat: ChatSession): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  let promptTokens = 0;
  let completionTokens = 0;

  for (const msg of chat.messages) {
    const count = getMessageTokens(msg);
    if (msg.role === 'user' || msg.role === 'system') {
      promptTokens += count;
    } else if (msg.role === 'assistant') {
      completionTokens += count;
    }
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export function computeChatsTokenBreakdown(chats: ChatSession[]): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  let promptTokens = 0;
  let completionTokens = 0;

  for (const chat of chats) {
    const breakdown = computeChatTokenBreakdown(chat);
    promptTokens += breakdown.promptTokens;
    completionTokens += breakdown.completionTokens;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export function getModelPricingRate(modelId: string): {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
} {
  const lower = (modelId || '').trim().toLowerCase();

  if (lower.includes('gpt-5-nano')) {
    return { inputUsdPerMillion: 0.05, outputUsdPerMillion: 0.4 };
  }
  if (lower.includes('gpt-4o-mini')) {
    return { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 };
  }
  if (lower.includes('gpt-6.2-sol') || lower.includes('gpt-4o') || lower === 'agent-4o') {
    return { inputUsdPerMillion: 2.5, outputUsdPerMillion: 10.0 };
  }
  if (lower.includes('o3-mini') || lower === 'agent-o3-mini') {
    return { inputUsdPerMillion: 1.1, outputUsdPerMillion: 4.4 };
  }
  if (lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) {
    return { inputUsdPerMillion: 2.0, outputUsdPerMillion: 8.0 };
  }
  if (lower.includes('claude') && lower.includes('opus')) {
    return { inputUsdPerMillion: 15.0, outputUsdPerMillion: 75.0 };
  }
  if (lower.includes('claude') && lower.includes('haiku')) {
    return { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4.0 };
  }
  if (lower.includes('claude')) {
    return { inputUsdPerMillion: 3.0, outputUsdPerMillion: 15.0 };
  }

  return { inputUsdPerMillion: 2.5, outputUsdPerMillion: 10.0 };
}

export function estimateModelCostUsd(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rate = getModelPricingRate(modelId);
  const inputCost = (Math.max(0, promptTokens) / 1_000_000) * rate.inputUsdPerMillion;
  const outputCost = (Math.max(0, completionTokens) / 1_000_000) * rate.outputUsdPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}

export function estimateUserCostBreakdown(user: ManagedUser): {
  totalUsd: number;
  openAiUsd: number;
  anthropicUsd: number;
} {
  if (user.modelBreakdown && user.modelBreakdown.length > 0) {
    let openAiUsd = 0;
    let anthropicUsd = 0;
    for (const item of user.modelBreakdown) {
      const cost =
        typeof item.estimatedCostUsd === 'number'
          ? item.estimatedCostUsd
          : estimateModelCostUsd(item.model, item.promptTokens, item.completionTokens);
      if (item.provider === 'ANTHROPIC') {
        anthropicUsd += cost;
      } else {
        openAiUsd += cost;
      }
    }
    return {
      totalUsd: Number((openAiUsd + anthropicUsd).toFixed(6)),
      openAiUsd: Number(openAiUsd.toFixed(6)),
      anthropicUsd: Number(anthropicUsd.toFixed(6)),
    };
  }

  const totalPrompt = Math.max(0, user.tokenUsage.promptTokens);
  const totalCompletion = Math.max(0, user.tokenUsage.completionTokens);

  if (user.chats.length > 0) {
    const chatWeights = user.chats.map((chat) => {
      const breakdown = computeChatTokenBreakdown(chat);
      const weight = Math.max(1, breakdown.totalTokens);
      return {
        model: chat.model,
        provider: getModelProvider(chat.model),
        weight,
      };
    });
    const totalWeight = chatWeights.reduce((sum, item) => sum + item.weight, 0);

    let openAiUsd = 0;
    let anthropicUsd = 0;
    for (const item of chatWeights) {
      const share = totalWeight > 0 ? item.weight / totalWeight : 1 / chatWeights.length;
      const cost = estimateModelCostUsd(item.model, totalPrompt * share, totalCompletion * share);
      if (item.provider === 'anthropic') {
        anthropicUsd += cost;
      } else {
        openAiUsd += cost;
      }
    }

    const sumTotal = Number((openAiUsd + anthropicUsd).toFixed(6));
    if (typeof user.tokenUsage.estimatedCostUsd === 'number' && sumTotal === 0) {
      return {
        totalUsd: user.tokenUsage.estimatedCostUsd,
        openAiUsd: user.tokenUsage.estimatedCostUsd,
        anthropicUsd: 0,
      };
    }

    return {
      totalUsd: sumTotal,
      openAiUsd: Number(openAiUsd.toFixed(6)),
      anthropicUsd: Number(anthropicUsd.toFixed(6)),
    };
  }

  const fallbackCost =
    typeof user.tokenUsage.estimatedCostUsd === 'number'
      ? user.tokenUsage.estimatedCostUsd
      : estimateModelCostUsd('gpt-6.2-sol', totalPrompt, totalCompletion);

  return {
    totalUsd: fallbackCost,
    openAiUsd: fallbackCost,
    anthropicUsd: 0,
  };
}

export function formatUsd(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (safe === 0) return '$0.00';
  if (safe < 0.01) return `$${safe.toFixed(4)}`;
  return `$${safe.toFixed(2)}`;
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toLocaleString();
}

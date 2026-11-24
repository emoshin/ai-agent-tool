import { describe, expect, it } from 'vitest';
import { AVAILABLE_MODELS, DEFAULT_BOT_SETTINGS, getModelProvider } from './defaults';
import { estimateModelCostUsd, getModelPricingRate, MODEL_PRICING_LIST } from './tokens';

describe('Models and pricing configuration', () => {
  it('exposes flagship and lowest-cost models for OpenAI and Anthropic', () => {
    expect(AVAILABLE_MODELS.map((m) => m.id)).toEqual([
      'gpt-6.2-sol',
      'gpt-5-nano',
      'claude-opus-5-5',
      'claude-3-5-haiku',
    ]);
    expect(DEFAULT_BOT_SETTINGS.defaultModel).toBe('gpt-6.2-sol');
    expect(getModelProvider('gpt-6.2-sol')).toBe('openai');
    expect(getModelProvider('gpt-5-nano')).toBe('openai');
    expect(getModelProvider('claude-opus-5-5')).toBe('anthropic');
    expect(getModelProvider('claude-3-5-haiku')).toBe('anthropic');
  });

  it('computes accurate USD pricing rates for flagship and budget models', () => {
    expect(MODEL_PRICING_LIST.map((r) => r.modelPattern)).toEqual([
      'gpt-6.2-sol',
      'gpt-5-nano',
      'claude-opus-5-5',
      'claude-3-5-haiku',
    ]);
    expect(getModelPricingRate('gpt-6.2-sol')).toEqual({
      inputUsdPerMillion: 2.5,
      outputUsdPerMillion: 10.0,
    });
    expect(getModelPricingRate('gpt-5-nano')).toEqual({
      inputUsdPerMillion: 0.05,
      outputUsdPerMillion: 0.4,
    });
    expect(getModelPricingRate('claude-opus-5-5')).toEqual({
      inputUsdPerMillion: 15.0,
      outputUsdPerMillion: 75.0,
    });
    expect(getModelPricingRate('claude-3-5-haiku')).toEqual({
      inputUsdPerMillion: 0.8,
      outputUsdPerMillion: 4.0,
    });

    expect(estimateModelCostUsd('gpt-5-nano', 1_000_000, 1_000_000)).toBe(0.45);
    expect(estimateModelCostUsd('claude-3-5-haiku', 1_000_000, 1_000_000)).toBe(4.8);
  });
});

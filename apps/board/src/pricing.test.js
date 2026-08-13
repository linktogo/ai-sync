import { test, expect } from 'vitest';
import { costByModel, costOf } from './pricing.js';

function usage(overrides = {}) {
  return { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, ...overrides };
}

test('costByModel prices a single model at its own rate', () => {
  const result = costByModel({
    byModel: {
      'claude-sonnet-5': usage({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheCreationInputTokens: 1_000_000, cacheReadInputTokens: 1_000_000 }),
    },
  });
  expect(result).toEqual({ 'claude-sonnet-5': 22.05 }); // 3 + 15 + 3.75 + 0.3, from PRICING['claude-sonnet-5']
});

test('costByModel prices multiple models independently and does not blend rates', () => {
  const result = costByModel({
    byModel: {
      'claude-sonnet-5': usage({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheCreationInputTokens: 1_000_000, cacheReadInputTokens: 1_000_000 }),
      'claude-opus-5': usage({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheCreationInputTokens: 1_000_000, cacheReadInputTokens: 1_000_000 }),
    },
  });
  expect(result).toEqual({ 'claude-sonnet-5': 22.05, 'claude-opus-5': 110.25 });
});

test('costByModel falls back to the default rate under an "unknown" key when byModel is empty', () => {
  const result = costByModel({ ...usage({ inputTokens: 1_000_000 }), byModel: {} });
  expect(result).toEqual({ unknown: 3 }); // PRICING.default.input
});

test('costByModel falls back to the default rate under an "unknown" key when byModel is absent (pre-migration entries)', () => {
  const result = costByModel(usage({ inputTokens: 1_000_000, outputTokens: 1_000_000 }));
  expect(result).toEqual({ unknown: 18 }); // 3 + 15, PRICING.default
});

test('costByModel returns an empty object for null/undefined usage', () => {
  expect(costByModel(null)).toEqual({});
  expect(costByModel(undefined)).toEqual({});
});

test('costByModel prices an unrecognized model name at the default rate, keyed by its own name', () => {
  const result = costByModel({ byModel: { 'some-future-model': usage({ inputTokens: 1_000_000 }) } });
  expect(result).toEqual({ 'some-future-model': 3 });
});

test('costOf sums every model bucket from costByModel into one total', () => {
  const total = costOf({
    byModel: {
      'claude-sonnet-5': usage({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheCreationInputTokens: 1_000_000, cacheReadInputTokens: 1_000_000 }),
      'claude-opus-5': usage({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheCreationInputTokens: 1_000_000, cacheReadInputTokens: 1_000_000 }),
    },
  });
  expect(total).toEqual(132.3);
});

test('costOf returns 0 for null usage', () => {
  expect(costOf(null)).toBe(0);
});

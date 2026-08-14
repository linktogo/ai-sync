// €/million tokens. Maintained by hand — no network pricing lookup. Update
// this table (and only this table) when Anthropic's published prices change;
// cost is computed at render time from raw token counts, so a correction here
// retroactively re-prices the entire history.
export const PRICING = {
  'claude-opus-5': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-5': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  default: { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
};

const PER_MILLION = 1_000_000;
export const UNKNOWN_MODEL = 'unknown';

function costForModel(usage, rate) {
  if (!usage) return 0;
  return (
    (usage.inputTokens ?? 0) * rate.input
    + (usage.outputTokens ?? 0) * rate.output
    + (usage.cacheCreationInputTokens ?? 0) * rate.cacheWrite
    + (usage.cacheReadInputTokens ?? 0) * rate.cacheRead
  ) / PER_MILLION;
}

// Cost broken down per model, so a chart can render one segment per model.
// A session with no byModel breakdown (pre-migration history, or a transcript
// turn with no message.model) is priced as a whole at the default rate, under
// the 'unknown' key — never silently dropped or zeroed out.
export function costByModel(usage) {
  if (!usage) return {};
  const byModel = usage.byModel;
  if (byModel && Object.keys(byModel).length > 0) {
    const out = {};
    for (const [model, modelUsage] of Object.entries(byModel)) {
      out[model] = costForModel(modelUsage, PRICING[model] ?? PRICING.default);
    }
    return out;
  }
  return { [UNKNOWN_MODEL]: costForModel(usage, PRICING.default) };
}

export function costOf(usage) {
  return Object.values(costByModel(usage)).reduce((sum, cost) => sum + cost, 0);
}

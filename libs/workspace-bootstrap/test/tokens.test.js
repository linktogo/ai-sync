import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readTranscriptUsage, resolveHistoryPath, appendHistoryEntry } from '../src/tokens.js';

test('readTranscriptUsage sums usage across assistant lines, including sidechain turns', async () => {
  const lines = [
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 } } }),
    JSON.stringify({ type: 'assistant', isSidechain: true, message: { usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 } } }),
  ].join('\n') + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 11, outputTokens: 22, cacheCreationInputTokens: 33, cacheReadInputTokens: 44, byModel: {} });
});

test('readTranscriptUsage counts usage from a repeated message.id only once', async () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: { id: 'msg_1', usage: { input_tokens: 2, output_tokens: 138, cache_creation_input_tokens: 12942, cache_read_input_tokens: 19608 } },
  });
  const lines = [line, line, line].join('\n') + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 2, outputTokens: 138, cacheCreationInputTokens: 12942, cacheReadInputTokens: 19608, byModel: {} });
});

test('readTranscriptUsage sums usage from distinct message.id values', async () => {
  const lines = [
    JSON.stringify({ type: 'assistant', message: { id: 'msg_1', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1 } } }),
    JSON.stringify({ type: 'assistant', message: { id: 'msg_2', usage: { input_tokens: 2, output_tokens: 2, cache_creation_input_tokens: 2, cache_read_input_tokens: 2 } } }),
  ].join('\n') + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 3, outputTokens: 3, cacheCreationInputTokens: 3, cacheReadInputTokens: 3, byModel: {} });
});

test('readTranscriptUsage skips non-assistant lines and assistant lines without usage', async () => {
  const lines = [
    JSON.stringify({ type: 'user', message: { content: 'hi' } }),
    JSON.stringify({ type: 'assistant', message: {} }),
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 5, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }),
  ].join('\n') + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 5, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, byModel: {} });
});

test('readTranscriptUsage skips malformed JSON lines and blank lines', async () => {
  const lines = [
    '{not json',
    '',
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1 } } }),
  ].join('\n');
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 1, outputTokens: 1, cacheCreationInputTokens: 1, cacheReadInputTokens: 1, byModel: {} });
});

test('readTranscriptUsage returns zeroed totals and an empty byModel when the file cannot be read', async () => {
  const usage = await readTranscriptUsage('/missing.jsonl', { read: async () => { throw new Error('ENOENT'); } });
  assert.deepEqual(usage, { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, byModel: {} });
});

test('resolveHistoryPath derives history.jsonl next to the board file', () => {
  assert.equal(resolveHistoryPath('/ws/.ai-sync/board.json'), path.join('/ws/.ai-sync', 'history.jsonl'));
});

test('appendHistoryEntry ensures the directory and appends one JSON line per call', async () => {
  const calls = [];
  await appendHistoryEntry('/d/history.jsonl', { a: 1 }, {
    ensureDir: async (dir, opts) => calls.push(['ensureDir', dir, opts]),
    append: async (file, data) => calls.push(['append', file, data]),
  });
  assert.deepEqual(calls, [
    ['ensureDir', '/d', { recursive: true }],
    ['append', '/d/history.jsonl', '{"a":1}\n'],
  ]);
});

test('readTranscriptUsage handles assistant entries with undefined message', async () => {
  const lines = JSON.stringify({ type: 'assistant' }) + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, byModel: {} });
});

test('readTranscriptUsage handles entries with all token types at zero', async () => {
  const lines = JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }) + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, byModel: {} });
});

test('readTranscriptUsage handles usage objects with missing token properties', async () => {
  const lines = JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1 } } }) + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 1, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, byModel: {} });
});

test('readTranscriptUsage handles assistant entries with null message', async () => {
  const lines = JSON.stringify({ type: 'assistant', message: null }) + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, byModel: {} });
});

test('readTranscriptUsage returns empty usage for blank input', async () => {
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => '\n\n\n' });
  assert.deepEqual(usage, { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, byModel: {} });
});

test('readTranscriptUsage correctly handles sidechain flag in assistant entries', async () => {
  const lines = JSON.stringify({ type: 'assistant', isSidechain: true, message: { usage: { input_tokens: 5, output_tokens: 10, cache_creation_input_tokens: 15, cache_read_input_tokens: 20 } } }) + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 5, outputTokens: 10, cacheCreationInputTokens: 15, cacheReadInputTokens: 20, byModel: {} });
});

test('readTranscriptUsage accumulates multiple entries correctly', async () => {
  const lines = [
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 } } }),
    '',
    '{invalid}',
    JSON.stringify({ type: 'user', message: { content: 'ignored' } }),
    JSON.stringify({ type: 'assistant', message: {} }),
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1 } } }),
  ].join('\n');
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 2, outputTokens: 3, cacheCreationInputTokens: 4, cacheReadInputTokens: 5, byModel: {} });
});

test('readTranscriptUsage handles usage object with no token properties (all nullish)', async () => {
  const lines = JSON.stringify({ type: 'assistant', message: { usage: {} } }) + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, byModel: {} });
});

test('readTranscriptUsage attributes usage to the message.model that produced it', async () => {
  const lines = [
    JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5', usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 } } }),
    JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5', usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 } } }),
  ].join('\n') + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage, {
    inputTokens: 11, outputTokens: 22, cacheCreationInputTokens: 33, cacheReadInputTokens: 44,
    byModel: {
      'claude-sonnet-5': { inputTokens: 1, outputTokens: 2, cacheCreationInputTokens: 3, cacheReadInputTokens: 4 },
      'claude-opus-5': { inputTokens: 10, outputTokens: 20, cacheCreationInputTokens: 30, cacheReadInputTokens: 40 },
    },
  });
});

test('readTranscriptUsage sums repeated turns from the same model into one byModel bucket', async () => {
  const lines = [
    JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1 } } }),
    JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5', usage: { input_tokens: 2, output_tokens: 2, cache_creation_input_tokens: 2, cache_read_input_tokens: 2 } } }),
  ].join('\n') + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage.byModel, {
    'claude-sonnet-5': { inputTokens: 3, outputTokens: 3, cacheCreationInputTokens: 3, cacheReadInputTokens: 3 },
  });
});

test('readTranscriptUsage counts a repeated message.id toward its model only once', async () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: { id: 'msg_1', model: 'claude-sonnet-5', usage: { input_tokens: 2, output_tokens: 138, cache_creation_input_tokens: 12942, cache_read_input_tokens: 19608 } },
  });
  const lines = [line, line, line].join('\n') + '\n';
  const usage = await readTranscriptUsage('/t.jsonl', { read: async () => lines });
  assert.deepEqual(usage.byModel, {
    'claude-sonnet-5': { inputTokens: 2, outputTokens: 138, cacheCreationInputTokens: 12942, cacheReadInputTokens: 19608 },
  });
});

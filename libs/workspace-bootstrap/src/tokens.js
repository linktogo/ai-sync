import { readFile, appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const EMPTY_USAGE = { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 };

// Every Claude Code hook payload carries transcript_path, a local JSONL file
// where each assistant turn has a message.usage object. board.json never
// gets token counts from the hook payload itself — this is the only source.
export async function readTranscriptUsage(transcriptPath, { read = readFile } = {}) {
  let raw;
  try {
    raw = await read(transcriptPath, 'utf8');
  } catch {
    return { ...EMPTY_USAGE };
  }
  const totals = { ...EMPTY_USAGE };
  const seenMessageIds = new Set();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const usage = entry?.type === 'assistant' ? entry.message?.usage : null;
    if (!usage) continue;
    // Claude Code writes one JSONL line per content block (thinking/text/tool_use)
    // of a single API response, repeating the same usage on every line for that
    // response, keyed by the same message.id — count each response's usage once.
    const messageId = entry.message?.id;
    if (messageId) {
      if (seenMessageIds.has(messageId)) continue;
      seenMessageIds.add(messageId);
    }
    totals.inputTokens += usage.input_tokens ?? 0;
    totals.outputTokens += usage.output_tokens ?? 0;
    totals.cacheCreationInputTokens += usage.cache_creation_input_tokens ?? 0;
    totals.cacheReadInputTokens += usage.cache_read_input_tokens ?? 0;
  }
  return totals;
}

export function resolveHistoryPath(boardPath) {
  return path.join(path.dirname(boardPath), 'history.jsonl');
}

export async function appendHistoryEntry(historyPath, entry, opts = {}) {
  const { append = appendFile, ensureDir = mkdir } = opts;
  await ensureDir(path.dirname(historyPath), { recursive: true });
  await append(historyPath, `${JSON.stringify(entry)}\n`);
}

// COMMONS — output guardrails (C4, defense-in-depth).
//
// The agents already constrain model output to a Zod schema. These guardrails add
// a CONTENT pass on the prose that reaches an official document: the escalation
// brief and the resolution/recurrence narratives. Even a well-formed JSON string
// can carry an injected URL (a phishing link in a brief sent to a councillor) or
// an off-corpus report reference. We have no URL allow-list, so the policy is:
// strip every URL from authority-facing prose, and verify that any report ID a
// model cites actually exists in the corpus.

const URL_RE = /\bhttps?:\/\/\S+/gi;

// Remove any URL from model-drafted prose (no allow-list → block all). Returns the
// scrubbed text plus whether anything was removed (so the caller can audit-log it).
export function stripUrls(text: string): { text: string; removed: number } {
  const matches = text.match(URL_RE);
  if (!matches) return { text, removed: 0 };
  return { text: text.replace(URL_RE, "[link removed]"), removed: matches.length };
}

// Verify a set of cited report IDs all exist in the corpus. Returns the unknown
// ones (empty array = all valid). Used to reject off-corpus references a model
// might hallucinate or be coerced into inventing.
export function unknownReportIds(cited: string[], corpusIds: Set<string>): string[] {
  return cited.filter((id) => !corpusIds.has(id));
}

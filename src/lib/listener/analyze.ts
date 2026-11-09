import {
  CHECKLIST,
  CHECKLIST_KEYS,
  normalizeProposal,
  readiness,
  type ChecklistKey,
  type ProfileFact,
  type ProposedFact,
} from "../profile/facts";

export interface AnalysisInput {
  /** Recent transcript segments, oldest first. */
  transcript: string[];
  facts: ProfileFact[];
  /** Questions already on screen, so the agent does not repeat them. */
  openQuestions: string[];
}

export interface Analysis {
  suggestions: { text: string; checklistKey: ChecklistKey | null }[];
  facts: NonNullable<ReturnType<typeof normalizeProposal>>[];
}

export const LISTENER_SYSTEM = `You are a silent assistant helping an FDE (a human concierge) interview a business owner about a problem an AI employee could solve.

Rules:
- You never speak to the guest. You write for the FDE only.
- Use only what is in the transcript. Never invent a fact, number or quote.
- For each fact, set "provenance" to "said" ONLY if the guest said it, and then include "quote" copied word for word from the transcript. Otherwise use "inferred" and leave "quote" empty.
- Never mark anything as confirmed. The FDE confirms facts, not you.
- Suggest at most 3 follow-up questions, short and plain, most useful first. Ask about whatever the checklist is still missing.
- Note habits and the psychology of the problem (for example, an owner who does not check email), as "constraints".

Reply with JSON only:
{"suggestions":[{"text":"...","checklistKey":"problem|frequency|duration|who|cost|tools|constraints|success"}],
 "facts":[{"text":"...","provenance":"said|inferred","quote":"...","checklistKey":"..."}]}`;

export function buildListenerPrompt(input: AnalysisInput): {
  system: string;
  user: string;
} {
  const { missing } = readiness(input.facts);
  const known =
    input.facts.map((f) => `- [${f.provenance}] ${f.text}`).join("\n") ||
    "(nothing yet)";
  const missingText =
    missing
      .map((k) => CHECKLIST.find((c) => c.key === k)?.label ?? k)
      .join("; ") || "(nothing)";
  const asked = input.openQuestions.map((q) => `- ${q}`).join("\n") || "(none)";
  const user = [
    "Checklist items still missing:",
    missingText,
    "",
    "Facts already on the profile:",
    known,
    "",
    "Questions already shown to the FDE (do not repeat):",
    asked,
    "",
    "Transcript so far (oldest first):",
    input.transcript.join("\n"),
  ].join("\n");
  return { system: LISTENER_SYSTEM, user };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** A quote counts only if it really appears in the transcript. */
export function quoteIsReal(quote: string, transcript: string[]): boolean {
  const q = norm(quote);
  return q.length > 0 && norm(transcript.join(" ")).includes(q);
}

/** Reads the model's reply defensively. Bad pieces are dropped, not trusted. */
export function parseAnalysis(raw: unknown, input: AnalysisInput): Analysis {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const seenQ = new Set(input.openQuestions.map(norm));
  const suggestions: Analysis["suggestions"] = [];
  for (const s of Array.isArray(obj.suggestions) ? obj.suggestions : []) {
    const text = typeof s?.text === "string" ? s.text.trim() : "";
    if (!text || seenQ.has(norm(text))) continue;
    seenQ.add(norm(text));
    const key = CHECKLIST_KEYS.includes(s?.checklistKey)
      ? (s.checklistKey as ChecklistKey)
      : null;
    suggestions.push({ text, checklistKey: key });
    if (suggestions.length === 3) break;
  }
  const seenF = new Set(input.facts.map((f) => norm(f.text)));
  const facts: Analysis["facts"] = [];
  for (const f of Array.isArray(obj.facts)
    ? (obj.facts as ProposedFact[])
    : []) {
    const p = normalizeProposal(f);
    if (!p || seenF.has(norm(p.text))) continue;
    // A "said" claim whose quote is not in the transcript is a made-up quote.
    if (
      p.provenance === "said" &&
      !(p.quote && quoteIsReal(p.quote, input.transcript))
    ) {
      facts.push({ ...p, provenance: "inferred", quote: null });
    } else facts.push(p);
    seenF.add(norm(p.text));
  }
  return { suggestions, facts };
}

/** Used when no model key is set: one plain question per missing checklist item. */
export function stubAnalysis(input: AnalysisInput): Analysis {
  const QUESTIONS: Record<ChecklistKey, string> = {
    problem: "What is the one task you wish someone else handled?",
    frequency: "How often does that come up?",
    duration: "How long does it take each time?",
    who: "Who does it today?",
    cost: "What does it cost you when it slips?",
    tools: "Which tools or apps do you use for it?",
    constraints:
      "Is there anything that makes it hard, such as when you check email?",
    success: "What would a good result look like?",
  };
  const seen = new Set(input.openQuestions.map(norm));
  const out: Analysis["suggestions"] = [];
  for (const key of readiness(input.facts).missing) {
    const text = QUESTIONS[key];
    if (seen.has(norm(text))) continue;
    out.push({ text, checklistKey: key });
    if (out.length === 2) break;
  }
  return { suggestions: out, facts: [] };
}

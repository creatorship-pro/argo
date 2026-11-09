// Hand-written to match docs/blueprint/schema.json (the schema is the source of
// truth). If you change one, change the other.

export type Provenance =
  "said" | "read-back-confirmed" | "inferred" | "fde-approved";

export type AutonomyLevel = "low" | "medium" | "high";

export type CapabilityKind =
  "model" | "skill" | "mcp" | "cli" | "script" | "memory" | "scheduler";

export interface Capability {
  /** Stable id such as `email.drafts`. Blueprints refer to this, not the vendor. */
  id: string;
  vendor: string;
  kind: CapabilityKind;
  access: string;
  connectsTo?: string;
  permissions?: string[];
  risk?: "low" | "medium" | "high";
  riskNote?: string;
  license?: string;
  vetted: boolean;
  pinnedVersion: string | null;
  reviewedBy: string | null;
  /** YYYY-MM-DD */
  reviewedOn: string | null;
  status?: "illustrative" | "draft" | "vetted";
}

export interface EvidenceItem {
  id: string;
  fact: string;
  provenance: Provenance;
  quote: string | null;
}

export interface Routine {
  name: string;
  /** `calendar` is a systemd OnCalendar expression. */
  schedule: { calendar: string; timeZone: string };
  prompt: string;
  toolsAllowed: string[];
  /** `none`, `continue-latest` or `named:<name>`. */
  session: string;
  approvals: string;
  onFailure: string;
}

export interface FitCheck {
  status: "feasible" | "blocked";
  gaps: { capability: string; need: string; vetted: boolean }[];
  fallback?: string;
  gapsLoggedForB1?: boolean;
}

export interface Design {
  id: string;
  name: string;
  autonomyLevel: AutonomyLevel;
  scope: string;
  role: { title: string; objective: string };
  model: {
    provider: string;
    model: string;
    fallback: { provider: string; model: string } | null;
    why: string;
    evidence: string[];
  };
  skills: { name: string; kind: string; why: string; evidence: string[] }[];
  tools: { capability: string; why: string; evidence?: string[] }[];
  memory: {
    instructions: { files: string[]; editedBy: string };
    state: { store: string; records: string; writtenBy: string };
    notes: { what: string; editedBy: string };
  };
  routines: Routine[];
  autonomyAndApprovals: {
    alone: string[];
    needsApproval: string[];
    never: string[];
    enforcedInCode: string[];
  };
  expectedOutcome: {
    metric: string;
    baselineHours: number | null;
    estimate: string;
    assumptions: string[];
    notAGuarantee: true;
  };
  accessNeeded: { system: string; permission: string; note: string | null }[];
  fitCheck: FitCheck;
  risks: string[];
  dataRetention: { default: string; decidedByOwner: boolean };
  pauseSwitch: { how: string; who: string };
  approvalChannel: { how: string; who: string[]; fallback: string };
  costEstimate: {
    monthly: number | null;
    basis: string;
    status: "to measure" | "measured";
  };
  acceptanceChecks: string[];
}

export interface BlueprintSet {
  blueprintVersion: string;
  status: "designed-not-deployed";
  note?: string;
  guest: {
    id: string;
    fictional?: boolean;
    name: string;
    business: string;
    size?: string;
    location?: string;
  };
  evidence: EvidenceItem[];
  valueAssessment: {
    problem: string;
    hoursLostPerWeek: number;
    rule?: string;
    confidence: string;
    dollarEstimate: number | null;
    dollarEstimateReason: string | null;
  };
  runtimeDefaults: {
    harness: "pi";
    host: string;
    runMode: string;
    isolation: string;
    secrets: string;
    toolAllowlist: string;
  };
  designs: Design[];
  recommendation: {
    designId: string;
    madeBy: string;
    reasons: string[];
    caveats: string[];
  };
  fdeChoice: string | null;
  fdeChoiceReason: string | null;
  scheduleFormat?: string;
  capabilityCatalog: Capability[];
}

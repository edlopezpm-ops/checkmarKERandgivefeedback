import { DomainError, object, type Product } from "./domain.ts";
import type { StudioAsset, StudioCampaign, StudioMaterial, StudioVariant } from "./studio.ts";

/** Portable agent records. Studio owns material/variant effects; agents retain
 * conversations, proposals and their exact source versions separately. */
export type AgentContextSelection = { productId?: string; campaignId?: string; materialIds: string[]; variantId?: string; studioRevision?: number };
export type AgentContext = {
  selection: AgentContextSelection; studioRevision: number; capturedAt: string;
  product?: Product; campaign?: StudioCampaign; materials: StudioMaterial[]; assets: StudioAsset[]; variant?: StudioVariant;
  sourceRefs: Array<{ materialId: string; contentVersion: number }>;
};
export type AgentConnection = {
  id: string; name: string; provider: "openai-codex"; runtime: "local-bridge";
  status: "pairing" | "connected" | "offline" | "revoked"; available: boolean;
  accountLabel?: string; authMode?: "chatgpt"; billingMode?: "chatgpt_subscription";
  model?: string; capabilities: string[]; createdAt: string; updatedAt: string; lastSeenAt?: string;
};
export type AgentSession = { id: string; title: string; context: AgentContextSelection; createdAt: string; updatedAt: string };
export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type AgentRun = {
  id: string; sessionId: string; connectionId: string; task: "copy" | "assembly" | "review";
  prompt: string; context: AgentContext; status: AgentRunStatus; cancelRequested: boolean;
  model?: string; message?: string; error?: string; createdAt: string; updatedAt: string; deadlineAt: string;
  resultRecoveredAt?: string;
};
export type AgentEvent = { id: string; runId: string; sessionId: string; type: "queued" | "activity" | "delta" | "completed" | "failed" | "cancelled" | "tool"; text: string; createdAt: string };
export type AgentCopy = { title: string; hook: string; body: string; cta: string };
export type AgentProposal = AgentCopy & {
  id: string; sessionId: string; runId: string; connectionId: string; kind: "copy";
  status: "proposed" | "edited" | "saved"; revision: number; model: string;
  sourceRefs: Array<{ materialId: string; contentVersion: number }>;
  productId?: string; campaignId?: string; studioRevision: number;
  createdAt: string; updatedAt: string; materialId?: string; variantId?: string;
  appliedRevision?: number; renderJobId?: string; exportedAt?: string; exportedRecipeRevision?: number;
};
export type AgentLimits = { dailyRuns: number; maxRunSeconds: number; maxConcurrentRuns: number; retentionDays: number };
export const DEFAULT_AGENT_LIMITS: AgentLimits = { dailyRuns: 30, maxRunSeconds: 300, maxConcurrentRuns: 1, retentionDays: 30 };
export type AgentOverview = { connections: AgentConnection[]; sessions: AgentSession[]; limits: AgentLimits; usage: { todayRuns: number; activeRuns: number } };
export type AgentSessionDetail = { session: AgentSession; runs: AgentRun[]; events: AgentEvent[]; proposals: AgentProposal[] };

export function validateAgentLimits(input: unknown): AgentLimits {
  const value = object(input), ranges = { dailyRuns: [1, 200], maxRunSeconds: [30, 900], maxConcurrentRuns: [1, 1], retentionDays: [1, 90] } as const;
  if (Object.keys(value).length !== 4 || Object.keys(value).some(key => !(key in ranges))) throw new DomainError("Revisa los límites del agente.");
  const result = {} as AgentLimits;
  for (const key of Object.keys(ranges) as Array<keyof AgentLimits>) {
    const number = value[key], [min, max] = ranges[key];
    if (typeof number !== "number" || !Number.isInteger(number) || number < min || number > max) throw new DomainError(`Revisa ${key}: ${min}–${max}.`);
    result[key] = number;
  }
  return result;
}
export function validateAgentCopy(input: unknown): AgentCopy {
  const value = object(input), result = {} as AgentCopy;
  for (const key of ["title", "hook", "body", "cta"] as const) {
    const text = value[key] ?? "", max = key === "body" ? 20_000 : key === "title" ? 160 : 240;
    if (typeof text !== "string" || text.length > max || text.includes("\0") || key === "body" && !text.trim()) throw new DomainError(`Revisa ${key} (máximo ${max}).`);
    result[key] = text.trim();
  }
  return result;
}

import type { StudioState, StudioVariant } from "../core/studio";

/** A view of Studio's current selection. Editorial Workspace campaigns are excluded. */
export type StudioAgentContext = {
  productId?: string; campaignId?: string; variantId?: string;
  materialIds: string[]; studioRevision?: number;
  productName?: string; campaignName?: string;
  materials: Array<{ id: string; title: string; contentVersion: number }>;
  state?: StudioState;
  recipeDirty?: boolean;
  busy?: boolean;
  job?: { id: string; status: string; error?: string };
};
export type AgentStudioUpdate = { nonce: number; materialId?: string; campaignId?: string; variantId?: string };

/** A recipe can change without changing its source IDs or content versions. */
export function agentVariantDrift(captured: Pick<StudioVariant, "id" | "recipeRevision"> | undefined, currentVariants: ReadonlyArray<Pick<StudioVariant, "id" | "recipeRevision">> | undefined): { id: string; capturedRevision: number; currentRevision?: number } | undefined {
  if (!captured || !currentVariants) return undefined;
  const current = currentVariants.find(variant => variant.id === captured.id);
  return current?.recipeRevision === captured.recipeRevision ? undefined : { id: captured.id, capturedRevision: captured.recipeRevision, currentRevision: current?.recipeRevision };
}

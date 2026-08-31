import { z } from "zod";

/**
 * Reading-side interpretation of an already-persisted DISCUSSION payload.
 *
 * The tone is derived rather than generated, so it applies to every digest already stored
 * without a migration, a backfill, or an extra provider call. Nothing here is persisted.
 */
export type DiscussionTone = "BROAD_AGREEMENT" | "CONTESTED" | "MIXED";

/** Deliberately loose: only the fields the tone depends on, so unrelated payload drift cannot suppress it. */
const TonedDiscussionSchema = z.object({
  consensus: z.string().nullish(),
  supportingViewpoints: z.array(z.unknown()).optional(),
  dissentingViewpoints: z.array(z.unknown()).optional(),
});

/** Total over every input: malformed, legacy, and absent payloads yield null instead of throwing. */
export function deriveDiscussionTone(payload: unknown): DiscussionTone | null {
  const parsed = TonedDiscussionSchema.safeParse(payload);
  if (!parsed.success) return null;

  const supporting = parsed.data.supportingViewpoints?.length ?? 0;
  const dissenting = parsed.data.dissentingViewpoints?.length ?? 0;
  if (supporting === 0 && dissenting === 0) return null;

  const consensus = parsed.data.consensus;
  if (typeof consensus === "string" && consensus.trim() !== "" && dissenting === 0) return "BROAD_AGREEMENT";
  if (consensus === null && dissenting >= supporting && dissenting >= 1) return "CONTESTED";
  return "MIXED";
}

import { createHash } from "node:crypto";
export type InsightFingerprintInput = { userId: string; code: string; currency: string | null; periodKey: string; relatedEntityType: string | null; relatedEntityId: string | null };
const canonical = (value: string | null): string => (value ?? "").normalize("NFC");
export const insightFingerprint = (input: InsightFingerprintInput): string => createHash("sha256").update(["v1", input.userId, input.code, input.currency, input.periodKey, input.relatedEntityType, input.relatedEntityId].map(canonical).join("|")) .digest("hex");

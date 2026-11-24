/**
 * Session-only draft persistence for the create-stream form, so an accidental
 * reload doesn't lose everything that was typed in. Stores only plain stream
 * parameters -- this form never collects a wallet secret or a signed
 * transaction, so there is nothing sensitive to exclude.
 */
const DRAFT_KEY = "stream-hive:create-draft";
const DRAFT_VERSION = 1;

export interface StreamDraft {
  version: number;
  recipient: string;
  amount: string;
  tokenContractId: string;
  tokenSymbol: string;
  tokenDecimals: number;
  cancellable: boolean;
  startDate: string; // ISO
  cliffDate: string | null; // ISO
  endDate: string; // ISO
}

export function saveStreamDraft(draft: Omit<StreamDraft, "version">): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: DRAFT_VERSION, ...draft }));
  } catch {
    // sessionStorage can throw (private browsing, quota, disabled) -- losing the draft is fine, crashing is not.
  }
}

export function loadStreamDraft(): StreamDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidDraftShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearStreamDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function isValidDraftShape(value: unknown): value is StreamDraft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === DRAFT_VERSION &&
    typeof v.recipient === "string" &&
    typeof v.amount === "string" &&
    typeof v.tokenContractId === "string" &&
    typeof v.tokenSymbol === "string" &&
    typeof v.tokenDecimals === "number" &&
    typeof v.cancellable === "boolean" &&
    typeof v.startDate === "string" &&
    (v.cliffDate === null || typeof v.cliffDate === "string") &&
    typeof v.endDate === "string" &&
    !Number.isNaN(new Date(v.startDate).getTime()) &&
    !Number.isNaN(new Date(v.endDate).getTime())
  );
}

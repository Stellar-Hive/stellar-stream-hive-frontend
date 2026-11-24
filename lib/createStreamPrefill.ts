/**
 * Parses and validates recipient/amount/token/cancellable values from the
 * create-stream page's URL query string (e.g. from a payroll link, an
 * invoice, or the "Duplicate" action on an existing stream), reusing the
 * form's own field validators so a missing or malformed value is silently
 * ignored -- never shown as an error, and never auto-submitted.
 */
import { isValidRecipientAddress, isValidStellarAddress } from "@/lib/stellar";

export interface StreamPrefill {
  recipient?: string;
  amount?: string;
  tokenContractId?: string;
  cancellable?: boolean;
}

// Same numeric shape `checkAmount` requires, without a decimals cap -- the
// token (and therefore its decimals) may not be resolved yet at parse time.
const AMOUNT_SHAPE = /^(?:\d+\.?\d*|\.\d+)$/;

function isPlausibleAmount(value: string): boolean {
  const text = value.trim();
  return AMOUNT_SHAPE.test(text) && Number(text) > 0;
}

export function parseStreamPrefill(params: URLSearchParams): StreamPrefill {
  const prefill: StreamPrefill = {};

  const recipient = params.get("recipient");
  if (recipient && isValidRecipientAddress(recipient)) {
    prefill.recipient = recipient;
  }

  const amount = params.get("amount");
  if (amount && isPlausibleAmount(amount)) {
    prefill.amount = amount.trim();
  }

  const token = params.get("token");
  if (token && isValidStellarAddress(token, "contract")) {
    prefill.tokenContractId = token;
  }

  const cancellable = params.get("cancellable");
  if (cancellable === "true" || cancellable === "false") {
    prefill.cancellable = cancellable === "true";
  }

  return prefill;
}

export function hasAnyPrefillValue(prefill: StreamPrefill): boolean {
  return (
    prefill.recipient !== undefined ||
    prefill.amount !== undefined ||
    prefill.tokenContractId !== undefined ||
    prefill.cancellable !== undefined
  );
}

/** Builds a `/streams/new` query string from a stream's real data, for the "Duplicate" action. */
export function buildDuplicateQueryString(input: {
  recipient: string;
  tokenContractId: string;
  amount: string;
  cancellable: boolean;
}): string {
  const params = new URLSearchParams({
    recipient: input.recipient,
    token: input.tokenContractId,
    amount: input.amount,
    cancellable: String(input.cancellable),
  });
  return params.toString();
}

import { stellarExpertTxUrl } from "@/lib/format";
import { STELLAR_EXPERT_NETWORK } from "@/lib/stellar";

/**
 * Shown when a transaction was submitted but not confirmed in time. The
 * transaction may still succeed, so this tells the user to check the hash on
 * the explorer before trying again.
 */
export function TransactionTimeoutNotice({ hash, className }: { hash: string; className?: string }) {
  const explorerUrl = stellarExpertTxUrl(hash, STELLAR_EXPERT_NETWORK);
  return (
    <p role="alert" className={className ?? "text-sm text-danger"}>
      Your transaction may still confirm. Check the hash on the explorer before retrying.{" "}
      {explorerUrl ? (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">
          View transaction {hash.slice(0, 8)}…
        </a>
      ) : (
        <span className="break-all font-mono">{hash}</span>
      )}
    </p>
  );
}

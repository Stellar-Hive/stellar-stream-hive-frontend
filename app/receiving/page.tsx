"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useStreams } from "@/hooks/useStreams";
import { StreamCard } from "@/components/stream/StreamCard";
import { StreamFilterBar } from "@/components/stream/StreamFilterBar";
import { RefreshButton } from "@/components/stream/RefreshButton";
import { TotalWithdrawable } from "@/components/stream/TotalWithdrawable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import {
  countByFilter,
  filterStreams,
  searchStreams,
  sortStreams,
  type StreamFilter,
  type StreamSort,
} from "@/lib/streamList";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { fetchWithdrawableOnChain, withdrawOnChain, ContractNotConfiguredError } from "@/lib/contracts";
import { describeFreighterError } from "@/lib/freighter";
import { stellarExpertTxUrl } from "@/lib/format";
import { STELLAR_EXPERT_NETWORK } from "@/lib/stellar";

interface WithdrawAllResult {
  streamId: string;
  hash: string | null;
  error: string | null;
}

export default function ReceivingPage() {
  const wallet = useWallet();
  const { streams, isLoading, error, apiConfigured, refetch } = useStreams(wallet.publicKey, "recipient");
  const [filter, setFilter] = useState<StreamFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<StreamSort>("default");
  const counts = useMemo(() => countByFilter(streams), [streams]);
  const visibleStreams = useMemo(
    () => sortStreams(searchStreams(filterStreams(streams, filter), query), sort),
    [streams, filter, query, sort]
  );
  const [withdrawAllStatus, setWithdrawAllStatus] = useState<"idle" | "running" | "done">("idle");
  const [withdrawAllResults, setWithdrawAllResults] = useState<WithdrawAllResult[]>([]);

  if (!wallet.isConnected) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold">Streams you&apos;re receiving</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">Connect your wallet to see streams where you&apos;re the recipient.</p>
        <div className="mt-6 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  // Completed streams may still hold an unclaimed remainder, and a cancelled
  // stream's frozen share can also be unclaimed; both are still withdrawable
  // on-chain even though streaming itself has stopped. The on-chain re-check
  // below (fetchWithdrawableOnChain) naturally skips any stream with nothing
  // left to withdraw.
  const withdrawableStreams = streams.filter(
    (s) => s.status === "active" || s.status === "cliff" || s.status === "completed" || s.status === "cancelled"
  );

  async function handleWithdrawAll() {
    setWithdrawAllStatus("running");
    setWithdrawAllResults([]);
    const results: WithdrawAllResult[] = [];
    for (const stream of withdrawableStreams) {
      try {
        const amount = await fetchWithdrawableOnChain(stream.id);
        if (amount > 0n && wallet.publicKey) {
          const { hash } = await withdrawOnChain({ streamId: stream.id, recipient: wallet.publicKey, amount });
          results.push({ streamId: stream.id, hash, error: null });
        }
      } catch (err) {
        const message = err instanceof ContractNotConfiguredError ? err.message : describeFreighterError(err);
        results.push({ streamId: stream.id, hash: null, error: message });
      }
    }
    setWithdrawAllResults(results);
    setWithdrawAllStatus("done");
    await refetch();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Streams you&apos;re receiving</h1>
          <p className="mt-1 text-muted">Streams where your connected wallet is the recipient.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RefreshButton onRefresh={refetch} isLoading={isLoading} />
          {withdrawableStreams.length > 0 && (
            <>
              <TotalWithdrawable streams={withdrawableStreams} />
              <button
                type="button"
                onClick={handleWithdrawAll}
                disabled={withdrawAllStatus === "running"}
                className="btn-primary"
              >
                {withdrawAllStatus === "running" ? (
                  <>
                    <Spinner size="sm" /> Withdrawing…
                  </>
                ) : (
                  `Withdraw All (${withdrawableStreams.length})`
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {withdrawAllStatus === "done" && (
        <div className="mb-4 rounded-xl border border-border bg-background/50 px-4 py-3 text-sm">
          <p className="mb-2 font-medium text-primary">
            Withdraw All results ({withdrawAllResults.filter((r) => r.hash).length} succeeded,{" "}
            {withdrawAllResults.filter((r) => r.error).length} failed)
          </p>
          {withdrawAllResults.length === 0 ? (
            <p className="text-muted">Nothing was withdrawable.</p>
          ) : (
            <ul className="space-y-1">
              {withdrawAllResults.map((r) => (
                <li key={r.streamId} className="flex items-center justify-between gap-3">
                  <span className="text-muted">Stream #{r.streamId}</span>
                  {r.hash ? (
                    <a
                      href={stellarExpertTxUrl(r.hash, STELLAR_EXPERT_NETWORK)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      View transaction
                    </a>
                  ) : (
                    <span className="text-danger">{r.error}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!apiConfigured && (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          The Stellar Stream Hive indexer API isn&apos;t configured yet, so this list may be incomplete. Set
          NEXT_PUBLIC_API_BASE_URL once the API is deployed.
        </div>
      )}

      {!isLoading && !error && streams.length > 0 && (
        <StreamFilterBar
          value={filter}
          onChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          counts={counts}
          exportable={visibleStreams}
          exportName="stellar-stream-hive-receiving-streams"
        />
      )}

      {isLoading ? (
        <CardSkeletonGrid />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : streams.length === 0 ? (
        <EmptyState
          title="No incoming streams yet"
          description="Streams sent to your address will appear here once the indexer picks them up."
          action={
            wallet.isConnected && wallet.publicKey ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="font-mono text-sm text-muted">{shortenAddress(wallet.publicKey)}</span>
                <CopyButton value={wallet.publicKey} label="Copy address" />
              </div>
            ) : undefined
          }
        />
      ) : visibleStreams.length === 0 ? (
        <EmptyState title="No matching streams" description="Try a different status filter or search." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStreams.map((stream) => (
            <StreamCard key={stream.id} stream={stream} role="recipient" />
          ))}
        </div>
      )}
    </div>
  );
}

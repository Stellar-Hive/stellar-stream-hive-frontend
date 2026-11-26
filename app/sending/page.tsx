"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { StreamCard } from "@/components/stream/StreamCard";
import { StreamFilterBar } from "@/components/stream/StreamFilterBar";
import { RefreshButton } from "@/components/stream/RefreshButton";
import { CancelButton } from "@/components/stream/CancelButton";
import { CardSkeletonGrid } from "@/components/ui/CardSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import {
  countByFilter,
  filterStreams,
  parseStreamListParams,
  searchStreams,
  sortStreams,
  streamListParamsToSearchParams,
  type StreamFilter,
  type StreamSort,
} from "@/lib/streamList";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { formatTokenAmount } from "@/lib/format";
import { groupOutgoingByToken } from "@/lib/outgoingTotals";

export default function SendingPage() {
  const wallet = useWallet();
  const {
    streams,
    isLoading,
    error,
    apiConfigured,
    lastUpdatedAt,
    refetch,
    filter,
    setFilter,
    query,
    setQuery,
    sort,
    setSort,
    counts,
    visibleStreams,
  } = useStreamListPage(wallet.publicKey, "sender");

  useEffect(() => {
    const search = streamListParamsToSearchParams({ filter, query, sort }).toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [filter, query, sort, pathname, router]);

  function clearFilters() {
    setFilter("all");
    setQuery("");
  }

  if (!wallet.isConnected) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold">Streams you&apos;re sending</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">Connect your wallet to see the streams you&apos;ve created.</p>
        <div className="mt-6 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const activeStreams = streams.filter(
    (s) => s.status === "active" || s.status === "cliff" || s.status === "scheduled"
  );
  const outgoingByToken = groupOutgoingByToken(activeStreams);
  const hasSingleToken = outgoingByToken.length === 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Streams you&apos;re sending</h1>
          <p className="mt-1 text-muted">Streams where your connected wallet is the sender.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <RefreshButton onRefresh={refetch} isLoading={isLoading} lastUpdatedAt={lastUpdatedAt} />
          {isLoading ? (
            <div className="card px-5 py-3 text-right" aria-busy="true">
              <p className="text-xs text-muted">Total outgoing commitment</p>
              <div className="mt-1 flex justify-end">
                <Spinner />
              </div>
            </div>
          ) : error ? (
            <div className="card px-5 py-3 text-right">
              <p className="text-xs text-muted">Total outgoing commitment</p>
              <p className="text-sm text-muted">Unavailable</p>
            </div>
          ) : outgoingByToken.length === 0 ? (
            <div className="card px-5 py-3 text-right">
              <p className="text-xs text-muted">Total outgoing commitment</p>
              <p className="text-sm text-muted">No live streams</p>
            </div>
          ) : hasSingleToken ? (
            <div className="card px-5 py-3 text-right">
              <p className="text-xs text-muted">Total outgoing commitment</p>
              <p className="mono-tabular text-xl font-bold text-primary">
                {formatTokenAmount(
                  outgoingByToken[0]?.amount ?? 0n,
                  outgoingByToken[0]?.symbol ?? "",
                  outgoingByToken[0]?.decimals ?? 7,
                  4
                )}
              </p>
            </div>
          ) : (
            <div className="card px-5 py-3 text-right">
              <p className="text-xs text-muted">Total outgoing commitment (per token)</p>
              <ul className="mt-1 space-y-0.5">
                {outgoingByToken.map((group) => (
                  <li key={group.contractId} className="mono-tabular text-sm font-bold text-primary">
                    {formatTokenAmount(group.amount, group.symbol, group.decimals, 4)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

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
          exportName="stellar-stream-hive-sending-streams"
        />
      )}

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isLoading ? "Loading streams…" : ""}
      </div>
      {isLoading ? (
        <CardSkeletonGrid />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : streams.length === 0 ? (
        <EmptyState
          title="No outgoing streams yet"
          description="Streams you create will show up here once the indexer picks them up."
          action={
            <Link href="/streams/new" className="btn-primary">
              Create a stream
            </Link>
          }
        />
      ) : visibleStreams.length === 0 ? (
        <EmptyState
          title="No streams match your filters"
          description="Try a different status filter or search term."
          action={
            <button type="button" onClick={clearFilters} className="btn-secondary">
              Clear filters
            </button>
          }
        />
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStreams.map((stream) => (
            <li key={stream.id}>
              <StreamCard
                stream={stream}
                role="sender"
                actions={
                  <CancelButton
                    streamId={stream.id}
                    senderAddress={stream.sender}
                    connectedAddress={wallet.publicKey}
                    cancellable={
                      stream.cancellable &&
                      (stream.status === "active" ||
                        stream.status === "cliff" ||
                        // The contract allows cancelling any stream that is not
                        // Cancelled or Completed, including Pending/scheduled ones.
                        // A scheduled stream that hasn't started refunds the sender in full.
                        stream.status === "scheduled")
                    }
                    tokenSymbol={stream.token.symbol}
                    tokenDecimals={stream.token.decimals}
                    onCancelled={refetch}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

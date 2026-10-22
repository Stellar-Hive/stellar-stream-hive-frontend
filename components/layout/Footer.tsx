import { NETWORK, STELLAR_EXPERT_NETWORK } from "@/lib/stellar";

export function Footer() {
  const streamContractId = process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
          <p>Stellar Stream Hive — an open-source Stellar Development Foundation grant project.</p>
          <p className="font-mono text-xs">
            Network: {NETWORK}
            {streamContractId && STELLAR_EXPERT_NETWORK && (
              <>
                {" · "}
                <a
                  href={`https://stellar.expert/explorer/${STELLAR_EXPERT_NETWORK}/contract/${streamContractId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline transition hover:text-white"
                >
                  Stream contract
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Stellar-Hive/stellar-stream-hive-contract"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            Contracts
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            href="https://github.com/Stellar-Hive/stellar-stream-hive-api"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            API
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            href="https://github.com/Stellar-Hive/stellar-stream-hive-frontend"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            Frontend
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

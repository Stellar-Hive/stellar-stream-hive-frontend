/**
 * Contract ID configuration and accessors for the Stellar Stream Hive Soroban contracts.
 *
 * Contract IDs are read from environment variables — they are NOT hardcoded,
 * because the contracts repo (stellar-stream-hive-contract) deploys
 * independently. Until NEXT_PUBLIC_STREAM_CONTRACT_ID /
 * NEXT_PUBLIC_VAULT_CONTRACT_ID / NEXT_PUBLIC_REGISTRY_CONTRACT_ID are set,
 * the getter functions throw ContractNotConfiguredError so the UI can show
 * a clear "not yet configured" state instead of a confusing RPC failure.
 *
 * See DEPLOYMENTS.md in https://github.com/Stellar-Hive/stellar-stream-hive-contract
 * for the addresses once they exist.
 */

export class ContractNotConfiguredError extends Error {
  constructor(public readonly contractName: string) {
    super(
      `${contractName} contract ID is not configured. Set the corresponding NEXT_PUBLIC_*_CONTRACT_ID ` +
        `environment variable once the contract is deployed (see DEPLOYMENTS.md in the ` +
        `stellar-stream-hive-contract repo).`
    );
    this.name = "ContractNotConfiguredError";
  }
}

export function getStreamContractId(): string {
  const id = process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
  if (!id) throw new ContractNotConfiguredError("Stream");
  return id;
}

export function getVaultContractId(): string {
  const id = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID;
  if (!id) throw new ContractNotConfiguredError("Vault");
  return id;
}

export function getRegistryContractId(): string {
  const id = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
  if (!id) throw new ContractNotConfiguredError("Registry");
  return id;
}

export function isStreamContractConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID;
}

/**
 * Non-throwing accessor for the Stream contract ID. Returns null when the
 * contract is not configured, so UI code can conditionally render links
 * without try/catch. Other callers should keep using getStreamContractId().
 */
export function getStreamContractIdOrNull(): string | null {
  return process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID || null;
}

export function isRegistryContractConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
}

/**
 * Contract call helpers for the Stellar Stream Hive Soroban contracts.
 *
 * This module re-exports contract IDs, read-only simulations, and write operations
 * from separate modules for better organization.
 *
 * Contract IDs are read from environment variables — they are NOT hardcoded,
 * because the contracts repo (stellar-stream-hive-contract) deploys
 * independently. Until NEXT_PUBLIC_STREAM_CONTRACT_ID /
 * NEXT_PUBLIC_VAULT_CONTRACT_ID / NEXT_PUBLIC_REGISTRY_CONTRACT_ID are set,
 * contract ID getter functions throw ContractNotConfiguredError so the UI can show
 * a clear "not yet configured" state instead of a confusing RPC failure.
 *
 * See DEPLOYMENTS.md in https://github.com/Stellar-Hive/stellar-stream-hive-contract
 * for the addresses once they exist.
 */

// Re-export contract ID configuration
export {
  ContractNotConfiguredError,
  getStreamContractId,
  getVaultContractId,
  getRegistryContractId,
  isStreamContractConfigured,
  getStreamContractIdOrNull,
  isRegistryContractConfigured,
} from "./contractIds";

// Re-export read-only contract calls
export { fetchStreamOnChain, fetchWithdrawableOnChain } from "./contractReads";

// Re-export write contract calls
export { createStreamOnChain, withdrawOnChain, cancelStreamOnChain } from "./contractWrites";

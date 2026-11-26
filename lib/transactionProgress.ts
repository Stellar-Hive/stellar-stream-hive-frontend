export type TransactionStep = 'signing' | 'submitted' | 'confirming';

export interface TransactionProgress {
  step: TransactionStep;
  message: string;
}

export const PROGRESS_MESSAGES: Record<TransactionStep, string> = {
  signing: 'Requesting signature...',
  submitted: 'Transaction submitted to network...',
  confirming: 'Waiting for confirmation...',
};

export function getProgressMessage(step: TransactionStep): string {
  return PROGRESS_MESSAGES[step] ?? "";
}

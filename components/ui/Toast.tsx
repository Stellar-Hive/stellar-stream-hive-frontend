'use client';

import { X } from 'lucide-react';
import { type Toast as ToastType } from '@/lib/toast';
import { stellarExpertTxUrl } from '@/lib/format';

export function Toast({ toast, onDismiss, network }: {
  toast: ToastType;
  onDismiss: () => void;
  network?: 'testnet' | 'public' | null;
}) {
  const bgColor = toast.type === 'success' ? 'bg-green-900' : toast.type === 'error' ? 'bg-red-900' : 'bg-blue-900';
  const textColor = toast.type === 'success' ? 'text-green-200' : toast.type === 'error' ? 'text-red-200' : 'text-blue-200';

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`${bgColor} ${textColor} p-4 rounded-lg flex items-start gap-3 max-w-sm`}
    >
      <div className="flex-1">
        <p>{toast.message}</p>
        {toast.txHash && network && (
          <a
            href={stellarExpertTxUrl(toast.txHash, network) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline hover:opacity-80"
          >
            View transaction
          </a>
        )}
      </div>
      {toast.dismissible !== false && (
        <button onClick={onDismiss} className="p-1 hover:opacity-80" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss, network }: {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
  network?: 'testnet' | 'public' | null;
}) {
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={() => onDismiss(toast.id)} network={network} />
        </div>
      ))}
    </div>
  );
}

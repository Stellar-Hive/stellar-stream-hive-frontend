import { Suspense } from "react";
import { CreateStreamForm } from "@/components/create/CreateStreamForm";

export default function NewStreamPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create a Stream</h1>
        <p className="mt-2 text-muted">
          Set a recipient, amount, and schedule. Funds are locked into the stream contract and released continuously
          from the start date to the end date.
        </p>
      </div>
      {/* CreateStreamForm reads the recipient/amount/token/cancellable query params (e.g. from
          a payroll link or the "Duplicate" action) via useSearchParams, which requires a
          Suspense boundary. */}
      <Suspense fallback={null}>
        <CreateStreamForm />
      </Suspense>
    </div>
  );
}

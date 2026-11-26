import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="mb-4 text-6xl" aria-hidden="true">
        🐝
      </span>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">
        This page doesn&apos;t exist, or the stream you were looking for may have moved.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}

import { notFound } from "next/navigation";
import { isValidStreamId } from "@/lib/validation";

/**
 * Stream ids are Soroban `u64` values. Guard the route at the layout level
 * (server-side, before the client page mounts) so a non-numeric id like
 * `/streams/abc` renders Next's 404 page instead of reaching the API/contract
 * and surfacing a confusing fetch error or a `BigInt` `SyntaxError`.
 */
export default async function StreamDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidStreamId(id)) {
    notFound();
  }

  return children;
}

import { notFound } from "next/navigation";
import { isValidStreamId } from "@/lib/validation";

/**
 * Stream ids are Soroban `u64` values. Guard the route at the layout level
 * (server-side, before the client page mounts) so a non-numeric id like
 * `/streams/abc` renders Next's 404 page instead of reaching the API/contract
 * and surfacing a confusing fetch error or a `BigInt` `SyntaxError`.
 */
export default function StreamDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  if (!isValidStreamId(params.id)) {
    notFound();
  }

  return children;
}

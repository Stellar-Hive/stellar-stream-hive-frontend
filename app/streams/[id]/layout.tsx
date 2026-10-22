import type { Metadata } from "next";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Stream #${params.id} - Stellar Stream Hive`,
  };
}

export default function StreamDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}

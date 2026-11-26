import type { MetadataRoute } from "next";
import { buildRobotsRules, isNoindexEnabled } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return buildRobotsRules(isNoindexEnabled(process.env.NEXT_PUBLIC_NOINDEX));
}

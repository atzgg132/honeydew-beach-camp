import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl;
  const routes = [
    "",
    "/rooms",
    "/rooms/single-bed",
    "/rooms/double-bed",
    "/gallery",
    "/amenities",
    "/about",
    "/contact",
    "/policies",
    "/book",
    "/manage-booking",
  ];
  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }));
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudyFlow",
    short_name: "StudyFlow",
    description: "Notes, assignments, exams, focus and AI study help in one calm workspace.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#16a05a",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Notes", url: "/notes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Focus Room", url: "/focus", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "AI Assistant", url: "/ai", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

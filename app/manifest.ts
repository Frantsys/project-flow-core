import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Flow",
    short_name: "Project Flow",
    description: "Workspaces, quadro kanban, sprints e documentos para times pequenos.",
    lang: "pt-BR",
    start_url: "/my-work",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#171717",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas Finance",
    short_name: "Atlas",
    description: "Organização financeira clara, precisa e orientada pelos seus dados.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f7f6",
    theme_color: "#062d31",
    lang: "pt-BR",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

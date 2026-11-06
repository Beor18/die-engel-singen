import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  images: {
    // El ancho original de las páginas del libro es 941 px: no tiene sentido pedir más.
    deviceSizes: [480, 640, 768, 941],
    imageSizes: [48, 96, 128, 256, 384],
    qualities: [60, 75, 86],
    formats: ["image/webp"],
    localPatterns: [{ pathname: "/libro/**" }],
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
};

export default config;

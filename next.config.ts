import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "tesseract.js"],
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {},
};

export default nextConfig;

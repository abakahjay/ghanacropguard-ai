import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Static single-page app. VITE_API_URL is the FullBackendd origin (CropGuard lives under
// /api/v1/cropguard there); it is baked in at build time.
export default defineConfig(({ mode }) => {
  const api = (loadEnv(mode, process.cwd()).VITE_API_URL || "http://localhost:7004").replace(/\/$/, "");
  // Same security headers as the production host (render.yaml), so `npm run preview` tests them.
  const headers = {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${api}`,
      `connect-src 'self' ${api}`,
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { port: 3000, strictPort: true },
    preview: { port: 3000, strictPort: true, headers },
    build: { sourcemap: false },
  };
});

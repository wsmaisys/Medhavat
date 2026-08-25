import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' https://cdnjs.cloudflare.com",
    "img-src 'self' data:",
    "font-src 'self' https://cdnjs.cloudflare.com",
    "connect-src 'self' ws:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(rootDirectory, "index.html"),
        aiAutomation: resolve(
          rootDirectory,
          "pages/services/ai-automation.html",
        ),
        digitalExperience: resolve(
          rootDirectory,
          "pages/services/digital-experience.html",
        ),
        customEngineering: resolve(
          rootDirectory,
          "pages/services/custom-engineering.html",
        ),
        brandGrowth: resolve(rootDirectory, "pages/services/brand-growth.html"),
      },
    },
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
});

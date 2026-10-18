import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const BACKEND = process.env.BIDWIRE_API ?? "http://localhost:8787";

// Proxy options shared by every backend path. SSE (/api/stream) must stream unbuffered.
const proxied = {
  target: BACKEND,
  changeOrigin: true,
  ws: false,
  configure: (proxy: any) => {
    proxy.on("proxyReq", (proxyReq: any, req: any) => {
      if (req.url?.startsWith("/api/stream")) proxyReq.setHeader("accept-encoding", "identity");
    });
    proxy.on("proxyRes", (proxyRes: any, req: any) => {
      // Headers on proxyRes are copied to the client response afterwards; never flush here.
      if (req.url?.startsWith("/api/stream")) {
        proxyRes.headers["cache-control"] = "no-cache, no-transform";
        proxyRes.headers["x-accel-buffering"] = "no";
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": here("./src"),
      "@shared": here("../shared"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      "/api": proxied,
      "/store": proxied,
      "/mcp": proxied,
      "/llms.txt": proxied,
      "/.well-known": proxied,
    },
  },
  preview: { port: 4173 },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});

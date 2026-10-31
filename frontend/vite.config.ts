import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (command === "build" && mode === "production") {
    if (env.VITE_PUBLIC_CATALOG_WRITES === "true") {
      throw new Error("Production builds must keep public catalog writes disabled.");
    }
    if (env.VITE_LOCAL_DEMO_MODE !== "true") {
      try {
        if (new URL(env.VITE_PUBLIC_API_URL).protocol !== "https:") {
          throw new Error();
        }
      } catch {
        throw new Error("Set VITE_PUBLIC_API_URL to the HTTPS URL of the production API before building.");
      }
    }
  }

  return {
    root: "frontend",
    base: "/",
    plugins: [react()],
    build: {
      target: "es2022",
      outDir: "../dist",
      emptyOutDir: true,
    },
    server: {
      // In dev, proxy /api calls to the backend
      proxy: {
        "/api": {
          target: env.VITE_PUBLIC_API_URL || "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});

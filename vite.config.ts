import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (command === "build" && mode === "production") {
    if (env.VITE_LOCAL_DEMO_MODE === "true") {
      throw new Error("Production website builds must not use local demo mode.");
    }
    if (env.VITE_PUBLIC_CATALOG_WRITES === "true") {
      throw new Error("Production website builds must keep public catalog writes disabled.");
    }
    try {
      if (new URL(env.VITE_PUBLIC_API_URL).protocol !== "https:") {
        throw new Error();
      }
    } catch {
      throw new Error("Set VITE_PUBLIC_API_URL to the HTTPS URL of the production API before building.");
    }
  }

  return {
    base: "/",
    plugins: [react()],
    build: {
      target: "es2022",
    },
  };
});

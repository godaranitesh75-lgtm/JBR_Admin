import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (command === "build" && mode === "production") {
    const demoMode = env.VITE_LOCAL_DEMO_MODE === "true";
    const explicitlyAllowDemoBuild = env.VITE_ALLOW_PRODUCTION_DEMO === "true";

    if (demoMode && !explicitlyAllowDemoBuild) {
      throw new Error("For an intentional demo deployment, set VITE_ALLOW_PRODUCTION_DEMO=true.");
    }
    if (env.VITE_PUBLIC_CATALOG_WRITES === "true") {
      throw new Error("Demo builds must keep public catalog writes disabled.");
    }
    if (!demoMode) {
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
  };
});

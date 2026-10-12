import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jbrelectrical.admin",
  appName: "JBR Electrical",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;

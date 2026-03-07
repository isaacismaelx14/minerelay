import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

const useCloudflareRuntime = process.env.ADMIN_RUNTIME === "cloudflare";

export default defineConfig({
  server: {
    hmr: {
      // Cloudflare + Vinext can emit transient cross-DO dev-runtime errors.
      // Keep UI usable while the runner recovers.
      overlay: false,
    },
  },
  plugins: [
    tailwindcss(),
    vinext(),
    ...(useCloudflareRuntime
      ? [
          cloudflare({
            viteEnvironment: {
              name: "rsc",
              childEnvironments: ["ssr"],
            },
          }),
        ]
      : []),
  ],
});

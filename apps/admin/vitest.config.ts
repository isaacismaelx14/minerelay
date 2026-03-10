import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      {
        find: "@minerelay/ui/globals.css",
        replacement: fileURLToPath(
          new URL("../../packages/ui/src/globals.css", import.meta.url),
        ),
      },
      {
        find: "@minerelay/ui",
        replacement: fileURLToPath(
          new URL("../../packages/ui/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/admin/**/*.{test.ts,test.tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node24",
    lib: {
      entry: "src/tools/css-injector/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: (id: string) =>
        id.startsWith("node:") || ["chokidar", "fast-glob", "commander"].includes(id),
    },
    outDir: "dist",
    sourcemap: true,
  },
});

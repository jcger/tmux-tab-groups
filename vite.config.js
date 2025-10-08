import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: "src/background.js",
        content: "src/content.js",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
        dir: "dist",
      },
    },
    target: "es2020",
  },
  publicDir: "public",
  assetsInclude: ["**/*.css"],
});

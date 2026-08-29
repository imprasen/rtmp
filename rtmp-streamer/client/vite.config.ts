import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:5011",
        changeOrigin: true,
      },
      "/whep": {
        target: "http://localhost:8889",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/whep/, ""),
      },
      "/hls": {
        target: "http://localhost:8888",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hls/, ""),
      },
    },
  },
});

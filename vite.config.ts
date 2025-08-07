// vite.config.ts
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin(), viteSingleFile()],
  root: path.resolve(__dirname, './src'),
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
      "react": "preact/compat",
      "react-dom": "preact/compat"
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        options: path.resolve(__dirname, './src/options.html'),
      },
    }
  }
});
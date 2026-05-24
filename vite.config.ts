import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vite';
import fs from 'fs';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

function chromeExtensionPlugin(): Plugin {
  return {
    name: 'chrome-extension-cleanup',
    closeBundle: {
      order: 'post',
      handler() {
        const distDir = resolve(rootDir, 'dist');

        const srcPopup = resolve(distDir, 'src/popup/popup.html');
        const dstPopup = resolve(distDir, 'popup.html');
        if (fs.existsSync(srcPopup)) {
          const html = fs.readFileSync(srcPopup, 'utf-8');
          const fixed = html
            .replace(/src="[^"]*popup\.js"/g, 'src="./popup.js"');
          fs.writeFileSync(dstPopup, fixed);
          fs.rmSync(resolve(distDir, 'src'), { recursive: true, force: true });
        }
      }
    }
  };
}

export default defineConfig({
  base: '',
  build: {
    rollupOptions: {
      input: {
        popup: resolve(rootDir, 'src/popup/popup.html'),
        content: resolve(rootDir, 'src/content/content.ts'),
        background: resolve(rootDir, 'src/background/background.ts')
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('content.css')) {
            return 'content.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: '[name].js',
      }
    },
    outDir: 'dist',
  },
  plugins: [chromeExtensionPlugin()],
});
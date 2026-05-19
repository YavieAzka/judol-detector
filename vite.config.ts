import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(rootDir, 'src/popup/popup.html'),
        content: resolve(rootDir, 'src/content/content.ts'),
        background: resolve(rootDir, 'src/background/background.ts')
      },
      output: {
        entryFileNames: '[name].js',
      }
    }
  }
});
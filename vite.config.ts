import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  },
  build: {
    outDir: './bundled',
    watch: process.env.DISABLE_WATCH
      ? null
      : {
          include: 'assets/**'
        },
    rollupOptions: {
      input: {
        main: './assets/ts/main.tsx',
        critical: './assets/ts/critical.ts'
      },
      output: {
        format: 'es',
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[hash:6].js',
        assetFileNames: '[ext]/[name].[ext]',
        compact: true
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: ['./assets/scss']
      }
    }
  }
})

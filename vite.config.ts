/* eslint import/no-extraneous-dependencies: 0 */
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import solidPlugin from 'vite-plugin-solid';
import solidSvg from 'vite-plugin-solid-svg';

export default defineConfig({
  // deployed as a GitHub Pages project site: https://koteitan.github.io/rabbit/
  base: '/rabbit/',
  plugins: [
    solidPlugin(),
    solidSvg(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'stream'],
    }),
  ],
  server: {
    port: 3000,
  },
  // Unexpectedly, JSX is replaced by React.createElement due to optimizeDeps.
  // https://github.com/vitejs/vite/issues/17310
  // optimizeDeps: {
  //   extensions: ['jsx'],
  // },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@/': `${import.meta.dirname}/src/`,
    },
  },
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: false, // parallel rebuilds must never leave dist empty
  target: 'es2022',
  external: ['@hearth/domain', 'zod'],
});

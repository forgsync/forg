import { defineConfig } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    inlineDynamicImports: true,
  },
  plugins: [nodeResolve(), commonjs(), json(), typescript()],
});

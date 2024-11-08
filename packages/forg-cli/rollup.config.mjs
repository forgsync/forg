import { defineConfig } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    inlineDynamicImports: true,
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    json(),
    typescript(),
    terser({
      keep_classnames: true,
    }),
    visualizer({
      emitFile: true,
      gzipSize: true,
    }),
  ],
});

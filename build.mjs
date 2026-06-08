// build.mjs — esbuild с ESM-сплиттингом для поддержки @xenova/transformers
import * as esbuild from 'esbuild'
import { mkdirSync } from 'fs'

mkdirSync('renderer/dist', { recursive: true })

await esbuild.build({
  entryPoints: ['src/index.jsx'],
  bundle:      true,
  outdir:      'renderer/dist',   // outdir вместо outfile — нужен для splitting
  splitting:   true,              // code-splitting для динамических import()
  format:      'esm',             // ES-модули (нужен <script type="module">)
  jsx:         'automatic',       // React 17+ transform
  target:      'chrome114',
  platform:    'browser',
  mainFields:  ['browser', 'module', 'main'],
  define:      { 'process.env.NODE_ENV': '"production"' },
  minify:      false,
  // Не бандлим onnxruntime-web — он сам грузит WASM с CDN
  external:    [],
})

console.log('✓ Сборка завершена → renderer/dist/index.js')

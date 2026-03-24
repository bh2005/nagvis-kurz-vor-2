import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom simuliert window, document, localStorage
    environment: 'jsdom',

    // Testdateien
    include: ['frontend/tests/unit/**/*.test.js'],

    // Lädt constants.js + resolveMacros aus nodes.js in den globalen Scope
    setupFiles: ['frontend/tests/unit/setup.js'],

    // Globale expect / describe / it ohne Import
    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Nur eigene JS-Quelldateien – keine node_modules, kein MkDocs-Output
      include: ['frontend/js/**/*.js'],
      exclude: ['frontend/js/gadget-renderer.js'],  // Canvas-heavy, separater Test
    },
  },
})

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  // Pixi + puzzelgeneratie per tab is zwaar; meer workers maakt de tests traag en wisselvallig.
  workers: 2,
  use: { baseURL: 'http://localhost:4173/', browserName: 'chromium' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

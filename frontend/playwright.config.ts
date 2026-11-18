import { defineConfig } from '@playwright/test';
// Requiere backend en :4000 con .env.test (npm run test:integration prepara fiado_test).
const baseURL = 'http://localhost:3100';
export default defineConfig({ testDir: './e2e', use: { baseURL }, webServer: { command: 'npm run dev -- --port 3100', url: baseURL, reuseExistingServer: false } });

import { defineConfig, devices } from "@playwright/test";

const PUERTO = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PUERTO}`, locale: "es-CO", trace: "retain-on-failure" },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /celular\.spec\.ts/ },
    { name: "celular", use: { ...devices["Pixel 7"] }, testMatch: /celular\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next dev -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Pruebas deterministas: sin IA y sin base de datos en disco.
    env: { ASISTENTE_MODO: "guiado", DB_DRIVER: "memoria", ADMIN_PASSWORD: "clave-e2e", ADMIN_SECRET: "secreto-e2e-de-prueba" },
  },
});

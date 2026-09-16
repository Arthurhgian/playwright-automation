import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3456';

export default defineConfig({
    testDir: './tests',

    //Fail the build if a .only was commmitted by accident.
    forbidOnly: !!process.env.CI,

    //No retries locally: a flaky test should be visible, not smoothed over,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI 
    ? [['github'], ['html', { open: 'never'}]]
    : [['list'], ['html', { open: 'never' }]],

    use: {
        baseURL: BASE_URL,

        // Evidence for failures. 'retain-on-failure' keeps a trace even with
        // retries: 0, unlike the commom 'on-first-retry'.
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',

        actionTimeout: 10_000,
        navigationTimeout: 15_000,
    },
    expect: {
        timeout: 5_000,
    },
    timeout: 30_000,

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome']},
        },
    ],
});
import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('loads and shows header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.logo')).toContainText('AgentTrail');
  });

  test('shows header filter buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.filter-btn[data-filter="all"]')).toBeVisible();
    await expect(page.locator('.filter-btn[data-filter="today"]')).toBeVisible();
    await expect(page.locator('.filter-btn[data-filter="week"]')).toBeVisible();
  });

  test('has search input', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#search-input')).toBeVisible();
  });

  test('shows filters and grouping controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#filters-toggle')).toBeVisible();
    await expect(page.locator('.group-btn[data-group="date"]')).toBeVisible();
  });

  test('renders session cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.session-card');
    const count = await page.locator('.session-card').count();
    expect(count).toBeGreaterThan(0);
  });

  test('shows date grouping headers', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.session-card');
    const dateHeaders = page.locator('.date-divider');
    const count = await dateHeaders.count();
    expect(count).toBeGreaterThan(0);
  });
});

import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('loads and shows header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.logo')).toContainText('AgentTrail');
  });

  test('shows sidebar filters', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=All Sessions')).toBeVisible();
    await expect(page.locator('text=Today')).toBeVisible();
    await expect(page.locator('text=This Week')).toBeVisible();
  });

  test('has search input', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#search-input')).toBeVisible();
  });

  test('renders session cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.session-card');
    const count = await page.locator('.session-card').count();
    expect(count).toBeGreaterThan(0);
  });
});

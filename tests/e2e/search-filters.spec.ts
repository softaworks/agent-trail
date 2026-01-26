import { expect, test } from '@playwright/test';

test.describe('Search and Filters', () => {
  test('filters sessions on input', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.session-card');
    const initialCount = await page.locator('.session-card').count();

    await page.fill('#search-input', 'nonexistent-xyz-123');
    await expect(page.locator('.session-card')).toHaveCount(0);
    expect(initialCount).toBeGreaterThan(0);
  });

  test('toggles search mode', async ({ page }) => {
    await page.goto('/');
    const modeButton = page.locator('#search-mode-btn');
    await expect(modeButton).toBeVisible();
    const label = page.locator('#search-mode-label');
    await expect(label).toHaveText('Quick');
    await modeButton.click();
    await expect(label).toHaveText('Deep');
  });

  test('filters by time - Today', async ({ page }) => {
    await page.goto('/');
    const todayFilter = page.locator('.filter-btn[data-filter="today"]');
    await todayFilter.click();
    await expect(todayFilter).toHaveClass(/active/);
  });

  test('displays filter counts', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.session-card');

    const allCount = page.locator('#count-all');
    const todayCount = page.locator('#count-today');
    const weekCount = page.locator('#count-week');

    await expect(allCount).toBeVisible();
    await expect(todayCount).toBeVisible();
    await expect(weekCount).toBeVisible();

    const allText = await allCount.textContent();
    expect(Number(allText)).toBeGreaterThanOrEqual(0);
  });
});

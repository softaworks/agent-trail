import { expect, test } from '@playwright/test';

test.describe('Session Detail', () => {
  test('navigates to session when clicking card', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.session-card');
    await page.locator('.session-card').first().click();
    await expect(page).toHaveURL(/\/session\//);
  });

  test('shows session messages', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.session-card');
    await page.locator('.session-card').first().click();
    await expect(page.locator('.message')).toHaveCount(2);
  });
});

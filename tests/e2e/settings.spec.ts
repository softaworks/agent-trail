import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const configPath = 'tests/e2e/fixtures/config.json';
const baseConfig = {
	  directories: [
	    {
	      path: 'tests/e2e/fixtures/sessions',
	      label: 'E2E',
	      color: '#10b981',
	      enabled: true,
	      type: 'claude',
	    },
	  ],
  pins: [],
  customTags: {},
  server: {
    port: 9847,
  },
};

test.beforeEach(async () => {
  await writeFile(configPath, JSON.stringify(baseConfig, null, 2), 'utf-8');
});

test.describe('Settings Modal', () => {
  test('opens when clicking settings button', async ({ page }) => {
    await page.goto('/');
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings-modal')).toHaveClass(/open/);
  });

  test('shows profile list', async ({ page }) => {
    await page.goto('/');
    await page.locator('#settings-btn').click();
    const count = await page.locator('#settings-directories .settings-directory-item').count();
    expect(count).toBeGreaterThan(0);
  });

  test('adds, edits, toggles, and deletes a profile', async ({ page }) => {
    await page.goto('/');
    await page.locator('#settings-btn').click();

    await page.locator('#add-directory-btn').scrollIntoViewIfNeeded();
    await page.locator('#add-directory-btn').click();
    await page.fill('#new-dir-path', 'tests/e2e/fixtures/sessions-extra');
    await page.fill('#new-dir-label', 'Extra');
    await page.click('#add-directory-form .btn-primary');

    const itemSelector = '.settings-directory-item[data-path="tests/e2e/fixtures/sessions-extra"]';
    await expect(page.locator(itemSelector)).toBeVisible();

    await page.locator(`${itemSelector} button[title="Edit"]`).click();
    await expect(page.locator('#edit-directory-modal')).toBeVisible();
    await page.fill('#edit-dir-label', 'Extra Updated');
    await page.click('#edit-directory-modal .btn-primary');
    await expect(
      page.locator(`${itemSelector} .settings-directory-label > span`).first(),
    ).toHaveText('Extra Updated');

    const toggle = page.locator(`${itemSelector} input[type="checkbox"]`);
    const slider = page.locator(`${itemSelector} .toggle .slider`);
    await expect(toggle).toBeChecked();
    await slider.click();
    await expect(toggle).not.toBeChecked();
    await slider.click();
    await expect(toggle).toBeChecked();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator(`${itemSelector} button[title="Delete"]`).click();
    await expect(page.locator(itemSelector)).toHaveCount(0);
  });
});

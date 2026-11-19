import { test, expect } from '@playwright/test';

test('LocalSpot muestra el título correcto', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Frontend');
});
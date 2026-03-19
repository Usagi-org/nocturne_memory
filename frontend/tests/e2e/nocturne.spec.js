import { expect, test } from '@playwright/test';

import { seedScenario } from './helpers/seed';


test.beforeEach(() => {
  seedScenario('full');
});


test('@smoke integrates a pending review group', async ({ page }) => {
  await page.goto('/review');

  await expect(page.getByRole('heading', { name: 'core://review_item' })).toBeVisible();
  await expect(page.getByText('Pending review update')).toBeVisible();

  await page.getByRole('button', { name: /integrate group/i }).click();

  await expect(page.getByText('Empty Sequence')).toBeVisible();
});


test('rejects a pending review group and restores the old content', async ({ page }) => {
  await page.goto('/review');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /reject group/i }).click();

  await page.goto('/memory?domain=core&path=review_item');

  await expect(page.getByText('Original review content')).toBeVisible();
  await expect(page.getByText('Pending review update')).toHaveCount(0);
});


test('@smoke edits a memory from the browser page', async ({ page }) => {
  await page.goto('/memory?domain=core&path=workspace');

  await expect(page.getByRole('heading', { name: 'workspace' })).toBeVisible();
  await page.getByRole('button', { name: /edit/i }).click();
  await page.getByLabel('Memory content').fill('Workspace note mentions Salem and GraphService.');
  await page.getByLabel('Disclosure').fill('When editing workspace');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page.getByText('Workspace note mentions Salem and GraphService.')).toBeVisible();
});


test('navigates the aliased subtree in the project domain', async ({ page }) => {
  await page.goto('/memory?domain=project&path=mirror_workspace');

  await expect(page.getByRole('heading', { name: 'mirror_workspace' })).toBeVisible();
  await page.getByRole('button', { name: /child/i }).click();

  await expect(page.getByText('Nested child note')).toBeVisible();
});


test('opens a glossary popup and jumps to the linked node', async ({ page }) => {
  await page.goto('/memory?domain=core&path=workspace');

  await page.getByText('Salem').click();
  await expect(page.getByText('core://glossary_target')).toBeVisible();
  await page.getByText('core://glossary_target').click();

  await expect(page.getByRole('heading', { name: 'glossary_target' })).toBeVisible();
  await expect(page.getByText('Salem target memory')).toBeVisible();
});


test('@smoke shows deprecated and orphaned memories on the maintenance page', async ({ page }) => {
  await page.goto('/maintenance');

  await expect(page.getByText('Original review content')).toBeVisible();
  await expect(page.getByText('Will become orphaned')).toBeVisible();

  await page.getByText('Original review content').click();
  await expect(page.getByText('Pending review update')).toBeVisible();
});

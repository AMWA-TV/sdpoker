/* Copyright (C) 2026 Advanced Media Workflow Association

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { expect, test, type Page } from '@playwright/test';
import { readSource } from '../nodeResults';

const editor = (page: Page) => page.locator('.cm-content');
const status = (page: Page) => page.getByTestId('status');

async function loadExample(page: Page, name: string) {
  await page.getByLabel('Load an example or test fixture').fill(name);
  await page.getByRole('option', { name, exact: true }).first().click();
  await expect(status(page)).toContainText(name);
}

async function selectedText(page: Page) {
  return page.evaluate(() => document.getSelection()?.toString());
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('an example is checked with its line endings, and its diagnostics lead to their lines', async ({ page }) => {
  const path = 'test/fixtures/invalid/missing-media.sdp';
  const lines = readSource(path).split('\r\n');
  await loadExample(page, 'missing-media.sdp');
  await expect(page.getByTestId('line-endings')).toHaveText('CRLF · original file');
  await expect(page.getByTestId('github-link')).toHaveAttribute(
    'href',
    `https://github.com/AMWA-TV/sdpoker/blob/master/${path}`,
  );

  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByTestId('error-count')).toHaveText('2 errors');
  await expect(page.getByTestId('duration')).toHaveText(/^\d+\.\d ms$/);
  await expect(page.getByTestId('endings-skipped')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'RFC 4566' }).getByTestId('validator-count')).toHaveText('1 error');
  await expect(page.getByRole('region', { name: 'RFC 4570' }).getByTestId('validator-count')).toHaveText('0 errors');
  await expect(page.getByRole('region', { name: 'ST 2110' }).getByTestId('validator-count')).toHaveText('1 error');

  // The missing connection data and the missing media description are both reported on the last line, line 4
  await expect(page.locator('.cm-sdp-error-marker')).toHaveCount(1);
  await expect(page.locator('.cm-line.cm-sdp-error-line')).toHaveText(lines[3]);
  await expect(page.locator('[data-testid="diagnostic"][data-line="4"]')).toHaveCount(2);

  await page.getByTestId('diagnostic').filter({ hasText: 'at least one media description' }).click();
  expect(await selectedText(page)).toBe(lines[3]);
});

test('editing marks the results stale and skips the line-ending check until reset', async ({ page }) => {
  await loadExample(page, 'missing-media.sdp');
  await page.getByRole('button', { name: 'Validate' }).click();
  await editor(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('x');
  await expect(page.getByText('Out of date')).toBeVisible();
  await expect(page.getByTestId('line-endings')).toHaveText('Original line endings unknown');

  await page.getByText('Validation options').click();
  await expect(page.getByLabel('Check line endings')).toBeDisabled();
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Out of date')).toHaveCount(0);
  await expect(page.getByTestId('endings-skipped')).toContainText('Line-ending validation skipped');

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('line-endings')).toHaveText('CRLF · original file');
  await expect(page.getByLabel('Check line endings')).toBeEnabled();
  await expect(page.getByLabel('Check line endings')).toBeChecked();

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(editor(page)).toHaveText('');
  await expect(status(page)).toContainText('0 lines');
});

test('pasted SDP is checked without its line endings', async ({ page }) => {
  await editor(page).click();
  await editor(page).evaluate((element, text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, readSource('test/fixtures/valid/st2110-20.sdp'));
  await expect(status(page)).toContainText('Pasted SDP');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByTestId('error-count')).toHaveText('0 errors');
  await expect(page.getByTestId('endings-skipped')).toBeVisible();
});

test('an opened file keeps its line endings, and blank lines do not move the diagnostics', async ({ page }) => {
  const text = readSource('test/fixtures/invalid/bad-line-format.sdp').replace('\r\n', '\r\n\r\n');
  const badLine = text.split('\r\n').indexOf('i= leading space') + 1;
  expect(badLine).toBe(5);
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'blank.sdp', mimeType: 'application/sdp', buffer: Buffer.from(text) });
  await expect(status(page)).toContainText('blank.sdp');
  await expect(page.getByTestId('line-endings')).toHaveText('CRLF · original file');
  await page.getByRole('button', { name: 'Validate' }).click();
  const diagnostic = page.getByTestId('diagnostic').filter({ hasText: "of the form '<type>=<value>'" });
  await expect(diagnostic).toHaveAttribute('data-line', `${badLine}`);
  await diagnostic.click();
  expect(await selectedText(page)).toBe('i= leading space');
});

test('a dropped file is opened', async ({ page }) => {
  await editor(page).evaluate((element, text) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([text], 'dropped.sdp', { type: 'application/sdp' }));
    element.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
  }, readSource('examples/st2110-20.sdp'));
  await expect(status(page)).toContainText('dropped.sdp');
  await expect(page.getByTestId('line-endings')).toHaveText('CRLF · original file');
});

test('the options panel prevents rejected combinations and resets to the defaults', async ({ page }) => {
  await page.getByText('Validation options').click();
  await page.getByLabel('IPv4 only').check();
  await expect(page.getByLabel('IPv6 only')).toBeDisabled();
  await page.getByLabel('Multicast only').check();
  await expect(page.getByLabel('Unicast only')).toBeDisabled();
  await page.getByLabel('Skip RFC 4566 checks').check();
  await page.getByLabel('Skip RFC 4570 checks').check();
  await expect(page.getByLabel('Skip ST 2110 checks')).toBeDisabled();

  await page.getByLabel('Traffic shaping').hover();
  // Tooltips of the earlier options can still be closing
  await expect(
    page.getByRole('tooltip').filter({ hasText: 'Check adherence to traffic shaping specification' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Reset options to defaults' }).click();
  await expect(page.getByLabel('IPv4 only')).not.toBeChecked();
  await expect(page.getByLabel('Skip RFC 4566 checks')).not.toBeChecked();
  await expect(page.getByLabel('Traffic shaping')).toBeChecked();
  await expect(page.getByLabel('Fail copies of examples')).toBeChecked();
});

test('the page shows the version, the commit, and that SDP stays in the browser', async ({ page }) => {
  await expect(page.getByTestId('version')).toHaveText(/^SDPoker \d+\.\d+\.\d+, built from [0-9a-f]{7}$/);
  await expect(page.getByTestId('privacy')).toHaveText(
    'SDP validation is performed entirely within your browser. Your SDP contents are not uploaded to a server.',
  );
});

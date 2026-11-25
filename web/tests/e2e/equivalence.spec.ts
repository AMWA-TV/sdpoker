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

import { expect, test } from '@playwright/test';
import { listSources } from '../../scripts/copy-examples.mjs';
import { nodeMessages, readSource } from '../nodeResults';
import { optionSets } from '../optionSets';

test('the checks in the browser return the Node.js messages for every SDP file', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.sdpoker !== undefined);

  const files = (await listSources()).map(({ path }) => ({ path, sdp: readSource(path) }));
  const browserMessages = await page.evaluate(
    ({ files, optionSets }) =>
      files.map(({ sdp }) =>
        Object.values(optionSets).map((options) =>
          window.sdpoker.validateSDP(sdp, options).diagnostics.map((d) => d.message),
        ),
      ),
    { files, optionSets },
  );

  files.forEach(({ path, sdp }, x) => {
    Object.values(optionSets).forEach((options, y) => {
      expect(browserMessages[x][y], path).toEqual(nodeMessages(sdp, options));
    });
  });
});

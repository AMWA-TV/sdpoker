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

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { listSources } from '../../scripts/copy-examples.mjs';
import { repositoryRoot } from '../nodeResults';

const dist = new URL('../../dist/', import.meta.url);

test('the bundle does not include the Node.js entry points or their dependencies', () => {
  const assets = new URL('assets/', dist);
  const code = readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(new URL(file, assets), 'utf8'))
    .join('\n');
  expect(code).toContain('as per RFC 4566 Section 5');
  for (const marker of [
    'yargs',
    'node:fs',
    'require("fs")',
    'readFile',
    'SDP file request resulted in non-OK response code', // index.js getSDP
    'File name or URL for SDP file must be provided', // sdpoker.js
  ]) {
    expect(code, marker).not.toContain(marker);
  }
});

test('the published SDP files are byte for byte the working tree files', async () => {
  const sources = await listSources();
  const sdpFiles = ['examples', 'test/fixtures'].flatMap((dir) =>
    readdirSync(join(repositoryRoot, dir), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.sdp'))
      .map((file) => `${dir}/${file.split('\\').join('/')}`),
  );
  const manifest = JSON.parse(readFileSync(new URL('sdp/manifest.json', dist), 'utf8'));
  const manifestPaths = manifest.map((entry: { path: string }) => entry.path);
  expect([...manifestPaths].sort()).toEqual(sdpFiles.sort());
  expect(manifestPaths).toEqual(sources.map(({ path }) => path));
  for (const { path } of sources) {
    const published = readFileSync(new URL(`sdp/${path}`, dist));
    expect(published.equals(readFileSync(`${repositoryRoot}/${path}`)), path).toBe(true);
  }
});

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

// Copy the SDP examples and test fixtures from the working tree into
// public/sdp, byte for byte, and list them in public/sdp/manifest.json
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const outputDir = fileURLToPath(new URL('../public/sdp', import.meta.url));

export const groups = [
  { group: 'Examples', dir: 'examples' },
  { group: 'Valid test fixtures', dir: 'test/fixtures/valid' },
  { group: 'Invalid test fixtures', dir: 'test/fixtures/invalid' },
];

export async function listSources() {
  const entries = [];
  for (const { group, dir } of groups) {
    const files = (await readdir(join(repositoryRoot, dir), { recursive: true }))
      .filter((file) => file.endsWith('.sdp'))
      .sort();
    for (const file of files) {
      const path = `${dir}/${file.split('\\').join('/')}`;
      entries.push({ id: path, group, name: file, path });
    }
  }
  return entries;
}

export async function copyExamples() {
  const entries = await listSources();
  await rm(outputDir, { recursive: true, force: true });
  for (const { path } of entries) {
    const target = join(outputDir, path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(repositoryRoot, path), target);
  }
  await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(entries, null, 2) + '\n');
  return entries;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const entries = await copyExamples();
  console.log(`Copied ${entries.length} SDP files to ${relative(process.cwd(), outputDir)}`);
}

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

// Results of calling the validation modules directly in Node.js, in the order
// that sdpoker.js reports them
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { ValidationOptions } from '../src/validation/types';

const require = createRequire(import.meta.url);
export const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

const modules = [
  { skip: 'skipRFC4566', module: require('../../checkRFC4566.js') },
  { skip: 'skipRFC4570', module: require('../../checkRFC4570.js') },
  { skip: 'skipST2110', module: require('../../checkST2110.js') },
] as const;

export function nodeMessages(sdp: string, options: ValidationOptions): string[] {
  const params = { ...options, verbose: false };
  return modules
    .filter(({ skip }) => !options[skip])
    .flatMap(({ module }) => (module.allSections(sdp, params) as Error[]).map((error) => error.message));
}

export function readSource(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

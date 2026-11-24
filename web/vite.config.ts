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

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const validationModules = /[\\/](check(RFC4566|RFC4570|ST2110)|lines)\.js$/;

// The validation modules are CommonJS, and the development server serves
// source files as ES modules without converting them, so wrap each one, and
// import each module that it requires.
function commonjsValidationModules(): Plugin {
  return {
    name: 'sdpoker-validation-modules',
    enforce: 'pre',
    transform(code, id) {
      if (!validationModules.test(id)) {
        return null;
      }
      const imports: string[] = [];
      const body = code.replace(/require\('(\.\/[^']+)'\)/g, (_, path) => {
        imports.push(`import required${imports.length} from '${path}';\n`);
        return `required${imports.length - 1}`;
      });
      return {
        code: `${imports.join('')}const module = { exports: {} };\n${body}\nexport default module.exports;\n`,
        map: null,
      };
    },
  };
}

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repositoryRoot }).toString().trim();
  } catch {
    return 'unknown';
  }
}

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  plugins: [commonjsValidationModules(), react()],
  define: {
    __SDPOKER_VERSION__: JSON.stringify(version),
    __SDPOKER_COMMIT__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? gitCommit()),
  },
  server: {
    fs: { allow: [repositoryRoot] },
  },
  test: {
    include: ['tests/unit/**/*.test.ts?(x)'],
  },
});

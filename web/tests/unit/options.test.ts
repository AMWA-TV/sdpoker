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

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultOptions } from '../../src/validation/defaults';
import { optionDisabled, optionGroups } from '../../src/validation/optionInfo';

// The options and defaults declared by the yargs options in sdpoker.js
const cliSource = readFileSync(new URL('../../../sdpoker.js', import.meta.url), 'utf8');
const cliOptions = Object.fromEntries(
  [...cliSource.matchAll(/^\s+(\w+): \{ type: 'boolean', default: (true|false), describe: '((?:[^'\\]|\\.)*)'/gm)].map(
    ([, key, value, describe]) => [key, { value: value === 'true', describe }],
  ),
);

describe('validation options', () => {
  it('reads the options from sdpoker.js', () => {
    expect(Object.keys(cliOptions).length).toBeGreaterThan(10);
  });

  it('has every command-line option except verbose, with its default and description', () => {
    const { verbose, ...expected } = cliOptions;
    expect(verbose).toBeDefined();
    expect(Object.keys(defaultOptions).sort()).toEqual(Object.keys(expected).sort());
    const panel = optionGroups.flatMap(({ options }) => options);
    expect(panel.map(({ key }) => key).sort()).toEqual(Object.keys(expected).sort());
    for (const { key, description } of panel) {
      expect(defaultOptions[key], key).toBe(expected[key].value);
      expect(description, key).toBe(expected[key].describe);
    }
  });

  it('prevents the combinations that sdpoker.js rejects', () => {
    expect(optionDisabled({ ...defaultOptions, useIP4: true }, 'useIP6')).toBe(true);
    expect(optionDisabled({ ...defaultOptions, useIP6: true }, 'useIP4')).toBe(true);
    expect(optionDisabled({ ...defaultOptions, multicast: true }, 'unicast')).toBe(true);
    expect(optionDisabled({ ...defaultOptions, unicast: true }, 'multicast')).toBe(true);
    expect(optionDisabled({ ...defaultOptions, skipRFC4566: true, skipRFC4570: true }, 'skipST2110')).toBe(true);
    expect(optionDisabled({ ...defaultOptions, skipRFC4566: true }, 'skipST2110')).toBe(false);
    expect(optionDisabled(defaultOptions, 'useIP6')).toBe(false);
  });
});

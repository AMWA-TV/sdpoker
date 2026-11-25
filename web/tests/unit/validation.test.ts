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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { listSources } from '../../scripts/copy-examples.mjs';
import { validateSDP, validators } from '../../src/validation/sdpoker';
import { nodeMessages, readSource } from '../nodeResults';
import { optionSets } from '../optionSets';

const sources = await listSources();

describe('validateSDP', () => {
  afterEach(() => vi.restoreAllMocks());

  it('finds SDP files to compare', () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  for (const [name, options] of Object.entries(optionSets)) {
    it(`returns the Node.js messages for every SDP file with the ${name} options`, () => {
      for (const { path } of sources) {
        const sdp = readSource(path);
        const messages = validateSDP(sdp, options).diagnostics.map((d) => d.message);
        expect(messages, path).toEqual(nodeMessages(sdp, options));
      }
    });
  }

  it('reports empty input without calling the validators', () => {
    const spies = validators.map((v) => vi.spyOn(v, 'check'));
    const result = validateSDP('', optionSets.defaults);
    expect(result.diagnostics).toEqual([{ id: '0', validator: 'RFC 4566', message: 'The SDP file is empty.' }]);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('reports a validator that throws as one diagnostic for that validator', () => {
    vi.spyOn(validators[2], 'check').mockImplementation(() => {
      throw new TypeError('boom');
    });
    const result = validateSDP(readSource('test/fixtures/valid/st2110-20.sdp'), optionSets.defaults);
    expect(result.diagnostics).toEqual([
      {
        id: '0',
        validator: 'ST 2110',
        message: 'The ST 2110 checks stopped with an unexpected error: boom',
        line: undefined,
      },
    ]);
  });

  it('places line diagnostics on the physical line, counting blank lines', () => {
    const sdp = 'v=0\r\n\r\no=- 1 1 IN IP4 192.0.2.1\r\nx=bad\r\n';
    const diagnostic = validateSDP(sdp, optionSets.defaults).diagnostics.find((d) =>
      d.message.includes('permitted type letter'),
    );
    expect(diagnostic?.message).toMatch(/^Line 4:/);
    expect(diagnostic?.line).toBe(4);
  });
});

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

import { describe, expect, it } from 'vitest';
import {
  applyEdit,
  emptyDocument,
  lineEndingsAvailable,
  openOriginal,
  reset,
  validationInput,
} from '../../src/document/document';
import { defaultOptions } from '../../src/validation/defaults';

const original = 'v=0\r\no=- 1 1 IN IP4 192.0.2.1\r\n';
const normalised = 'v=0\no=- 1 1 IN IP4 192.0.2.1\n';
const options = { ...defaultOptions, checkEndings: true };

describe('document state', () => {
  for (const source of ['file', 'example'] as const) {
    it(`checks the original text and its line endings for an unmodified ${source}`, () => {
      const document = { ...openOriginal(source, 'a.sdp', original), editorText: normalised };
      expect(lineEndingsAvailable(document)).toBe(true);
      expect(validationInput(document, options)).toEqual({ text: original, options });
    });

    it(`checks the editor text without line endings once a ${source} is edited`, () => {
      const document = applyEdit(openOriginal(source, 'a.sdp', original), normalised + 'x', false);
      expect(lineEndingsAvailable(document)).toBe(false);
      expect(validationInput(document, options)).toEqual({
        text: normalised + 'x',
        options: { ...options, checkEndings: false },
      });
    });

    it(`restores the original text and line endings when a ${source} is reset`, () => {
      const document = reset(applyEdit(openOriginal(source, 'a.sdp', original), 'x', false));
      expect(lineEndingsAvailable(document)).toBe(true);
      expect(validationInput(document, options)).toEqual({ text: original, options });
    });
  }

  it('treats a paste into an empty document as pasted SDP without line endings', () => {
    const document = applyEdit(emptyDocument, original, true);
    expect(document.source).toBe('paste');
    expect(lineEndingsAvailable(document)).toBe(false);
    expect(validationInput(document, options).options.checkEndings).toBe(false);
  });

  it('treats typed SDP as having no original line endings', () => {
    const document = applyEdit(emptyDocument, 'v', false);
    expect(document.source).toBe('manual');
    expect(lineEndingsAvailable(document)).toBe(false);
    expect(reset(document)).toBe(document);
  });

  it('treats a paste into a file as an edit', () => {
    const document = applyEdit(openOriginal('file', 'a.sdp', original), original + original, true);
    expect(document.source).toBe('file');
    expect(lineEndingsAvailable(document)).toBe(false);
  });
});

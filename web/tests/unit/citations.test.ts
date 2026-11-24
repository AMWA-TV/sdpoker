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
import { messageParts } from '../../src/validation/citations';

describe('messageParts', () => {
  it('links an RFC section, leaving out the full stop', () => {
    expect(messageParts('Bad origin, as per RFC 4566 Section 5.2.')).toEqual([
      { text: 'Bad origin, as per ' },
      { text: 'RFC 4566 Section 5.2', href: 'https://www.rfc-editor.org/rfc/rfc4566#section-5.2' },
      { text: '.' },
    ]);
  });

  it('links each of several RFC sections', () => {
    expect(messageParts('as per RFC 8331 Sections 3.1 and 4.')).toEqual([
      { text: 'as per ' },
      { text: 'RFC 8331 Sections 3.1', href: 'https://www.rfc-editor.org/rfc/rfc8331#section-3.1' },
      { text: ' and ' },
      { text: '4', href: 'https://www.rfc-editor.org/rfc/rfc8331#section-4' },
      { text: '.' },
    ]);
  });

  it('links an RFC without a section to the RFC', () => {
    expect(messageParts('allowed by RFC 7273, but')).toEqual([
      { text: 'allowed by ' },
      { text: 'RFC 7273', href: 'https://www.rfc-editor.org/rfc/rfc7273' },
      { text: ', but' },
    ]);
  });

  it('links a public SMPTE edition, and not an undated or non-public one', () => {
    expect(messageParts('ST 2110-10 Section 8.1 [also ST 2110-10:2022 Section 8.3, ST 2110-43:2021].')).toEqual([
      { text: 'ST 2110-10 Section 8.1 [also ' },
      { text: 'ST 2110-10:2022', href: 'https://pub.smpte.org/pub/st2110-10/st2110-10-2022.pdf' },
      { text: ' Section 8.3, ' },
      { text: 'ST 2110-43:2021' },
      { text: '].' },
    ]);
  });

  it('keeps markup in a message as text', () => {
    expect(messageParts("Line 1: value '<b>x</b>' is bad.")).toEqual([{ text: "Line 1: value '<b>x</b>' is bad." }]);
  });
});

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
import { messageParts } from '../../src/validation/citations';

describe('messageParts', () => {
  it('links every SMPTE document cited by the checks', () => {
    const source = readFileSync(new URL('../../../checkST2110.js', import.meta.url), 'utf8');
    const cited = new Set(source.match(/ST 2(?:022|110)-\d+(?::\d{4})?/g));
    expect(cited.size).toBeGreaterThan(10);
    for (const citation of cited) {
      expect(messageParts(citation)[0].href, citation).toBeDefined();
    }
  });

  it('links every VSF document cited by the checks', () => {
    const source = readFileSync(new URL('../../../checkST2110.js', import.meta.url), 'utf8');
    const cited = new Set(source.match(/VSF TR-\d+(?:-\d+)*(?::\d{4})?(?= (?:Sections?|Appendix))/g));
    expect(cited.size).toBeGreaterThan(5);
    for (const citation of cited) {
      expect(messageParts(citation)[0].href, citation).toBeDefined();
    }
  });

  it('links each VSF document of a citation', () => {
    expect(messageParts('as per VSF TR-10-1:2024 Section 10.3 and VSF TR-10-9:2025 Section 10.')).toEqual([
      { text: 'as per ' },
      {
        text: 'VSF TR-10-1:2024',
        href: 'https://static.vsf.tv/download/technical_recommendations/VSF_TR-10-1_2024-02-23.pdf',
      },
      { text: ' Section 10.3 and ' },
      {
        text: 'VSF TR-10-9:2025',
        href: 'https://static.vsf.tv/download/technical_recommendations/VSF_TR-10-9_v2_2025-05-13.pdf',
      },
      { text: ' Section 10.' },
    ]);
  });

  it('links every RFC section cited by the checks', () => {
    const source = ['checkRFC4566.js', 'checkRFC4570.js', 'checkST2110.js']
      .map((file) => readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8'))
      .join('\n');
    expect(source.match(/RFC \d+ (?:[Aa]ppendix|[Aa]nnex|[Cc]lause|section|§)/g)).toBeNull();
    const cited = new Set(source.match(/RFC \d+ Sections? [\d.]+(?:(?:, | and )[\d.]+)*/g));
    expect(cited.size).toBeGreaterThan(10);
    for (const citation of cited) {
      const sections = citation
        .replace(/^RFC \d+ Sections? /, '')
        .split(/, | and /)
        .map((section) => section.replace(/\.$/, ''));
      const anchors = messageParts(citation).flatMap(({ href }) => href?.split('#section-')[1] ?? []);
      expect(anchors, citation).toEqual(sections);
    }
  });

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

  it('links a dated SMPTE citation to that edition, and an undated one to the first edition', () => {
    expect(messageParts('ST 2110-10 Section 8.1 [also ST 2110-10:2022 Section 8.3, ST 2110-43:2021].')).toEqual([
      { text: 'ST 2110-10', href: 'https://pub.smpte.org/doc/st2110-10/20170918-pub/st2110-10-2017.pdf' },
      { text: ' Section 8.1 [also ' },
      { text: 'ST 2110-10:2022', href: 'https://pub.smpte.org/pub/st2110-10/st2110-10-2022.pdf' },
      { text: ' Section 8.3, ' },
      { text: 'ST 2110-43:2021', href: 'https://pub.smpte.org/doc/st2110-43/20210514-pub/st2110-43-2021.pdf' },
      { text: '].' },
    ]);
  });

  it('links ST 2022 citations', () => {
    expect(messageParts('as per ST 2022-8 Section 7.1 and ST 2110-21 Section 8.2.')).toEqual([
      { text: 'as per ' },
      { text: 'ST 2022-8', href: 'https://pub.smpte.org/doc/st2022-8/20190222-pub/st2022-8-2019.pdf' },
      { text: ' Section 7.1 and ' },
      { text: 'ST 2110-21', href: 'https://pub.smpte.org/doc/st2110-21/20171122-pub/st2110-21-2017.pdf' },
      { text: ' Section 8.2.' },
    ]);
  });

  it('does not link a SMPTE document that it does not know', () => {
    expect(messageParts('as per ST 2110-41.')).toEqual([{ text: 'as per ' }, { text: 'ST 2110-41' }, { text: '.' }]);
  });

  it('does not link a format parameter value', () => {
    expect(messageParts("'SSN' shall be 'ST2110-20:2017'.")).toEqual([{ text: "'SSN' shall be 'ST2110-20:2017'." }]);
  });

  it('keeps markup in a message as text', () => {
    expect(messageParts("Line 1: value '<b>x</b>' is bad.")).toEqual([{ text: "Line 1: value '<b>x</b>' is bad." }]);
  });
});

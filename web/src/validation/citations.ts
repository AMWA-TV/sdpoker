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

export type MessagePart = { text: string; href?: string };

// The publicly available SMPTE editions, by citation. A citation without a
// year is to the first edition.
const smptePublic: Record<string, string> = {
  'ST 2022-7': 'https://pub.smpte.org/doc/st2022-7/20131011-pub/st2022-7-2013.pdf',
  'ST 2022-8': 'https://pub.smpte.org/doc/st2022-8/20190222-pub/st2022-8-2019.pdf',
  'ST 2110-10': 'https://pub.smpte.org/doc/st2110-10/20170918-pub/st2110-10-2017.pdf',
  'ST 2110-10:2022': 'https://pub.smpte.org/pub/st2110-10/st2110-10-2022.pdf',
  'ST 2110-20': 'https://pub.smpte.org/doc/st2110-20/20170918-pub/st2110-20-2017.pdf',
  'ST 2110-20:2022': 'https://pub.smpte.org/pub/st2110-20/st2110-20-2022.pdf',
  'ST 2110-21': 'https://pub.smpte.org/doc/st2110-21/20171122-pub/st2110-21-2017.pdf',
  'ST 2110-21:2022': 'https://pub.smpte.org/pub/st2110-21/st2110-21-2022.pdf',
  'ST 2110-22': 'https://pub.smpte.org/doc/st2110-22/20190711-pub/st2110-22-2019.pdf',
  'ST 2110-22:2022': 'https://pub.smpte.org/pub/st2110-22/st2110-22-2022.pdf',
  'ST 2110-30': 'https://pub.smpte.org/doc/st2110-30/20170918-pub/st2110-30-2017.pdf',
  'ST 2110-30:2025': 'https://pub.smpte.org/pub/st2110-30/st2110-30-2025.pdf',
  'ST 2110-31': 'https://pub.smpte.org/doc/st2110-31/20180727-pub/st2110-31-2018.pdf',
  'ST 2110-40:2018': 'https://pub.smpte.org/doc/st2110-40/20180412-pub/st2110-40-2018.pdf',
  'ST 2110-40:2023': 'https://pub.smpte.org/pub/st2110-40/st2110-40-2023.pdf',
  'ST 2110-43:2021': 'https://pub.smpte.org/doc/st2110-43/20210514-pub/st2110-43-2021.pdf',
};

// The VSF Technical Recommendations, by citation, as listed at https://vsf.tv/technical-recommendations/
const vsfDownloads = 'https://static.vsf.tv/download/technical_recommendations';
const vsfPublic: Record<string, string> = {
  'VSF TR-08:2022': `${vsfDownloads}/VSF_TR-08_2022-04-20.pdf`,
  'VSF TR-10-1:2024': `${vsfDownloads}/VSF_TR-10-1_2024-02-23.pdf`,
  'VSF TR-10-2:2024': `${vsfDownloads}/VSF_TR-10-2_2024-02-23.pdf`,
  'VSF TR-10-3:2024': `${vsfDownloads}/VSF_TR-10-3_2024-02-23.pdf`,
  'VSF TR-10-4:2023': `${vsfDownloads}/VSF_TR-10-4_2023-04-14.pdf`,
  'VSF TR-10-5:2026': `${vsfDownloads}/VSF_TR-10-5_2026-02-17_v2.pdf`,
  'VSF TR-10-7:2024': `${vsfDownloads}/VSF_TR-10-7_2024-11-22.pdf`,
  'VSF TR-10-9:2025': `${vsfDownloads}/VSF_TR-10-9_v2_2025-05-13.pdf`,
  'VSF TR-10-11:2024': `${vsfDownloads}/VSF_TR-10-11_2024-02-23.pdf`,
  'VSF TR-10-12:2023': `${vsfDownloads}/VSF_TR-10-12_2023-08-30.pdf`,
};

// A section number such as 5, 5.2 or 6.4.1, without a sentence's full stop
const section = String.raw`\d+(?:\.\d+)*`;
const citation = new RegExp(
  String.raw`(RFC (\d+))(?: (Sections?) (${section}(?:(?:, | and )${section})*))?|(ST 2(?:022|110)-\d+(?::\d{4})?)|(VSF TR-\d+(?:-\d+)*(?::\d{4})?)`,
  'g',
);

function rfcParts(rfcText: string, rfc: string, word?: string, sections?: string): MessagePart[] {
  const base = `https://www.rfc-editor.org/rfc/rfc${rfc}`;
  if (!word || !sections) {
    return [{ text: rfcText, href: base }];
  }
  // The first link includes the RFC number, so that 'RFC 4566 Section 5' is one link
  const [first, ...rest] = sections.split(/(, | and )/);
  const parts: MessagePart[] = [{ text: `${rfcText} ${word} ${first}`, href: `${base}#section-${first}` }];
  for (const piece of rest) {
    parts.push(/^\d/.test(piece) ? { text: piece, href: `${base}#section-${piece}` } : { text: piece });
  }
  return parts;
}

export function messageParts(message: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of message.matchAll(citation)) {
    const [whole, rfcText, rfc, word, sections, smpte, vsf] = match;
    if (match.index > last) {
      parts.push({ text: message.slice(last, match.index) });
    }
    if (rfc) {
      parts.push(...rfcParts(rfcText, rfc, word, sections));
    } else if (smpte) {
      parts.push(smptePublic[smpte] ? { text: smpte, href: smptePublic[smpte] } : { text: smpte });
    } else {
      parts.push(vsfPublic[vsf] ? { text: vsf, href: vsfPublic[vsf] } : { text: vsf });
    }
    last = match.index + whole.length;
  }
  if (last < message.length) {
    parts.push({ text: message.slice(last) });
  }
  return parts;
}

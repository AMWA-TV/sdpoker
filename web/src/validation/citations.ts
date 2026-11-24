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

// The SMPTE editions that are publicly available, by citation
const smptePublic: Record<string, string> = {
  'ST 2110-10:2022': 'https://pub.smpte.org/pub/st2110-10/st2110-10-2022.pdf',
  'ST 2110-20:2022': 'https://pub.smpte.org/pub/st2110-20/st2110-20-2022.pdf',
  'ST 2110-21:2022': 'https://pub.smpte.org/pub/st2110-21/st2110-21-2022.pdf',
  'ST 2110-22:2022': 'https://pub.smpte.org/pub/st2110-22/st2110-22-2022.pdf',
  'ST 2110-30:2025': 'https://pub.smpte.org/pub/st2110-30/st2110-30-2025.pdf',
  'ST 2110-40:2023': 'https://pub.smpte.org/pub/st2110-40/st2110-40-2023.pdf',
};

// A section number such as 5, 5.2 or 6.4.1, without a sentence's full stop
const section = String.raw`\d+(?:\.\d+)*`;
const citation = new RegExp(
  String.raw`(RFC (\d+))(?: (Sections?) (${section}(?:(?:, | and )${section})*))?|(ST 2110-\d+:\d{4})`,
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
    const [whole, rfcText, rfc, word, sections, smpte] = match;
    if (match.index > last) {
      parts.push({ text: message.slice(last, match.index) });
    }
    if (rfc) {
      parts.push(...rfcParts(rfcText, rfc, word, sections));
    } else {
      parts.push(smptePublic[smpte] ? { text: smpte, href: smptePublic[smpte] } : { text: smpte });
    }
    last = match.index + whole.length;
  }
  if (last < message.length) {
    parts.push({ text: message.slice(last) });
  }
  return parts;
}

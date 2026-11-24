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

import type { ValidationOptions } from './types';

export interface OptionInfo {
  key: keyof ValidationOptions;
  label: string;
  // The description of the sdpoker command-line option
  description: string;
}

export const optionGroups: { title: string; options: OptionInfo[] }[] = [
  {
    title: 'Checks',
    options: [
      { key: 'skipRFC4566', label: 'Skip RFC 4566 checks', description: 'Skips RFC 4566 checks' },
      { key: 'skipRFC4570', label: 'Skip RFC 4570 checks', description: 'Skips RFC 4570 checks' },
      { key: 'skipST2110', label: 'Skip ST 2110 checks', description: 'Skips ST 2110 checks' },
      {
        key: 'should',
        label: 'Check "should" clauses',
        description: 'As well as shall, also check all should clauses',
      },
      {
        key: 'checkEndings',
        label: 'Check line endings',
        description: 'Check line endings are CRLF, no other CR/LF',
      },
      {
        key: 'noCopy',
        label: 'Fail copies of examples',
        description: 'Fail obvious copies of the SDP examples in ST 2110-10, ST 2110-10:2022 and VSF TR-08:2022',
      },
      {
        key: 'noMedia',
        label: 'Fail without media',
        description: 'Fail SDP files which do not include any media descriptions',
      },
    ],
  },
  {
    title: 'Addresses',
    options: [
      { key: 'useIP4', label: 'IPv4 only', description: 'All addresses expressed in IP v4 notation' },
      { key: 'useIP6', label: 'IPv6 only', description: 'All addresses expressed in IP v6 notation' },
      { key: 'multicast', label: 'Multicast only', description: 'Connection addresses must be multicast' },
      { key: 'unicast', label: 'Unicast only', description: 'Connection addresses must be unicast' },
    ],
  },
  {
    title: 'Streams',
    options: [
      { key: 'duplicate', label: 'Duplicate streams', description: 'Expect duplicate streams aka ST 2022-7' },
      {
        key: 'channelOrder',
        label: 'Channel order',
        description: 'Expect audio with ST 2110-30 channel-order',
      },
      {
        key: 'shaping',
        label: 'Traffic shaping',
        description: 'Check adherence to traffic shaping specification',
      },
      {
        key: 'midLast',
        label: 'a=mid last',
        description: 'Check each media description ends with a=mid, as expected by SMPTE RP 2110-23',
      },
    ],
  },
];

const exclusive: [keyof ValidationOptions, keyof ValidationOptions][] = [
  ['useIP4', 'useIP6'],
  ['multicast', 'unicast'],
];

const skips: (keyof ValidationOptions)[] = ['skipRFC4566', 'skipRFC4570', 'skipST2110'];

// An option is unavailable when turning it on would make a combination that
// the command-line tool rejects
export function optionDisabled(options: ValidationOptions, key: keyof ValidationOptions): boolean {
  if (options[key]) {
    return false;
  }
  if (exclusive.some(([a, b]) => (key === a && options[b]) || (key === b && options[a]))) {
    return true;
  }
  return skips.includes(key) && skips.filter((skip) => skip !== key).every((skip) => options[skip]);
}

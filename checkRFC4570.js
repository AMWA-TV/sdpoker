/* Copyright 2018 Streampunk Media Ltd.

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

const splitLines = sdp => sdp.match(/[^\r\n]+/g);
const concat = arrays => Array.prototype.concat.apply([], arrays);

const sourceFilterPattern = /^a=source-filter:\s(incl|excl)\sIN\s(IP4|IP6|\*)\s(\S+)(?:\s(\S+))+$/;
const cPattern = /^c=IN\s+(IP[46])\s+([^\s/]+)(\/\d+)?(\/[1-9]\d*)?$/;

// Connection and source filter addresses can be written in more than one form. IPv6 addresses can use upper or lower case
// hexadecimal digits, as per RFC 4566 Section 9, and can omit leading zeros and compress zeros, as per RFC 4291 Section 2.2,
// so compare their canonical form, as per RFC 5952 Section 4. Domain names are case-insensitive, as per RFC 4343.
const canonicalAddress = address => {
  try {
    return address.includes(':') ? new URL(`http://[${address}]`).hostname.slice(1, -1) : address.toLowerCase();
  } catch {
    return address.toLowerCase();
  }
};

// RFC 4570 Section 3 Test 1 - Source filters match an acceptable pattern
const test_30_1 = (sdp, params) => {
  let lines = splitLines(sdp);
  let errors = [];
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('a=source-filter')) {
      let sourceFilterMatch = lines[x].match(sourceFilterPattern);
      if (!sourceFilterMatch) {
        errors.push(new Error(`Line ${x + 1}: Attribute 'source-filter' is not an acceptable pattern, which must be of the form 'a=source-filter: <filter-mode> <filter-spec>', as per RFC 4570 Section 3.`));
        continue;
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4570 Section 3 Test 1 - Source filters match an acceptable pattern.');
  }
  return errors;
};

// RFC 4570 Section 3 Test 3 - Source filter destination addresses match a connection address
// A media-level source filter can match the session-level connection address, and a session-level source filter
// can match the session-level or any media-level connection address, as per RFC 4570 Section 3.
const test_30_3 = (sdp, params) => {
  let lines = splitLines(sdp);
  let errors = [];
  let globalAddr = null;
  let mediaAddr = null;
  let mediaAddrs = [];
  let globalFilters = [];
  let inMedia = false;
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('c=')) {
      let addrMatch = lines[x].match(cPattern);
      if (!addrMatch) {
        continue;
      }
      if (!inMedia) {
        globalAddr = canonicalAddress(addrMatch[2]);
      } else {
        mediaAddr = canonicalAddress(addrMatch[2]);
        mediaAddrs.push(mediaAddr);
      }
    }
    if (lines[x].startsWith('m=')) {
      inMedia = true;
      mediaAddr = null;
    }
    if (lines[x].startsWith('a=source-filter:')) {
      let sourceFilterMatch = lines[x].match(sourceFilterPattern);
      if (!sourceFilterMatch) {
        continue;
      }
      let destAddr = canonicalAddress(sourceFilterMatch[3]);
      if (!inMedia) {
        globalFilters.push({ line: x + 1, destAddr });
      } else if (destAddr != globalAddr && destAddr != mediaAddr && destAddr != '*') {
        errors.push(new Error(`Line ${x + 1}: Source filter destination addresses must match one or more connection addresses, as per RFC 4570 Section 3.`));
      }
    }
  }
  for (let { line, destAddr } of globalFilters) {
    if (destAddr != globalAddr && !mediaAddrs.includes(destAddr) && destAddr != '*') {
      errors.push(new Error(`Line ${line}: Source filter destination addresses must match one or more connection addresses, as per RFC 4570 Section 3.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4570 Section 3 Test 3 - Source filter destination addresses match a connection address.');
  }
  return errors;
};

const section_30 = (sdp, params) => {
  let tests = [ test_30_1, test_30_3 ];
  return concat(tests.map(t => t(sdp, params)));
};

const allSections = (sdp, params) => {
  let sections = [ section_30 ];
  return concat(sections.map(s => s(sdp, params)));
};

module.exports = {
  allSections,
  section_30
};

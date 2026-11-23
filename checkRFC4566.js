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

const badEndings = /^\n|[^\r]\n|\r[^\n]|\r$/;
const hasNoNewlineAtEnd = /[^\r\n]$/;
const blankLines = /^[\r\n]|\r\n?\r|\n\r?\n/;
const linePattern = /^([a-z]=\S.*|s= )$/;
const letterCheck = /^[vosiuepcbzkatrm].*$/;
// const spaceCheck = /\s\s/;
const mustHaves = [ 'v', 'o', 's', 't' ];
const followedBy = {
  session : {
    'v': { 'o': 'session' },
    'o': { 's': 'session' },
    's': { 'i': 'session', 'u': 'session', 'e': 'session', 'p': 'session',
      'c': 'session', 'b': 'session', 't': 'time' },
    'i': { 'i': 'session', 'u': 'session', 'e': 'session', 'p': 'session',
      'c': 'session', 'b': 'session', 't': 'time' },
    'u': { 'u': 'session', 'e': 'session', 'p': 'session',
      'c': 'session', 'b': 'session', 't': 'time' },
    'e': { 'e': 'session', 'p': 'session',
      'c': 'session', 'b': 'session', 't': 'time' },
    'p': { 'p': 'session',
      'c': 'session', 'b': 'session', 't': 'time' },
    'c': { 'c': 'session', 'b': 'session', 't': 'time' },
    'b': { 'b': 'session', 't': 'time' },
    'z': { 'z': 'session', 'k' : 'session',
      'a': 'session', 'm': 'media' },
    'k': { 'k' : 'session',
      'a': 'session', 'm': 'media' },
    'a': { 'a': 'session', 'm': 'media' },
  },
  time : {
    't': { 'r': 'time', 't': 'time', 'z': 'session', 'k' : 'session',
      'a': 'session', 'm': 'media' },
    'r': { 'r': 'time', 't': 'time', 'z': 'session', 'k' : 'session',
      'a': 'session', 'm': 'media' }
  },
  media : {
    'm': { 'i': 'media', 'c': 'media', 'b': 'media', 'k': 'media', 'a': 'media',
      'm': 'media' },
    'i': { 'i': 'media', 'c': 'media', 'b': 'media', 'k': 'media', 'a': 'media',
      'm' : 'media' },
    'c': { 'c': 'media', 'b': 'media', 'k': 'media', 'a': 'media',
      'm' : 'media' },
    'b': { 'b': 'media', 'k': 'media', 'a': 'media',
      'm' : 'media' },
    'k': { 'k': 'media', 'a': 'media',
      'm' : 'media' },
    'a': { 'a': 'media', 'm' : 'media' }
  }
};
const oPattern = /^o=(\S+)\s+(\d+)\s+(\d+)\s+IN\s+(IP[4|6])\s+(\S+)$/;
const cPattern = /^c=IN\s+(IP[46])\s+([^\s/]+)(\/\d+)?(\/[1-9]\d*)?$/;
const bPattern = /^b=[^\s:]+:\d+$/;
const tPattern = /^t=(0|[1-9]\d{9,})\s+(0|[1-9]\d{9,})$/;
const ip4Pattern = /^([1-9]\d?\d?)\.(\d\d?\d?)\.(\d\d?\d?)\.(\d\d?\d?)$/;
// IP6-address = hexpart [ ":" IP4-address ], as per RFC 4566 Section 9
const ip6Pattern = /^([0-9a-f]{1,4}(:[0-9a-f]{1,4})*|([0-9a-f]{1,4}(:[0-9a-f]{1,4})*)?::([0-9a-f]{1,4}(:[0-9a-f]{1,4})*)?)(:\d{1,3}(\.\d{1,3}){3})?$/i;
const multiPattern = /^(((22[4-9]|23[0-9])(\.(\d\d?\d?)){3})|(ff[0-7][123458e]:[0-9a-f:.]*))$/i;

// Section 5 Test 1 - check if line endings are all CRLF
const test50_1 = (sdp, params) => {
  if (!params.checkEndings) {
    if (params.verbose) {
      console.log('Test Skipped: RFC 4566 Section 5 Test 1 - Line endings are all CRLF. Use --checkEndings to test.');
    }
    return [];
  }
  let errors = [];
  if (badEndings.test(sdp)) {
    errors.push(new Error('SDP file contains record ending characters CR (0x0d) and/or LF (0x0a) separately from the expected CRLF pattern, as per RFC 4566 Section 5.'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 1 - Line endings are all CRLF.');
  }
  return errors;
};

// Section 5 Test 1.1 - check last record is terminated with a newline and there are no blank lines
const test50_1_1 = (sdp, params) => {
  let errors = [];
  if (hasNoNewlineAtEnd.test(sdp)) {
    errors.push(new Error('SDP file does not contain a newline character at the end of the last record, as per RFC 4566 Section 5.'));
  }
  if (blankLines.test(sdp)) {
    errors.push(new Error('Blank lines are not permitted, as per RFC 4566 Section 5.'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 1.1 - Last record ends with a newline and there are no blank lines.');
  }
  return errors;
};

const splitLines = sdp => sdp.match(/[^\r\n]+/g);

// Section 5 Test 2 - check each line is an acceptable format
const test_50_2 = (lines, params) => {
  let errors = [];
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (!linePattern.test(lines[x])) {
      errors.push(new Error(
        `Line ${x + 1}: Every line of an SDP file must be of the form '<type>=<value>' with <type> being one character and no whitespace either side of the equals, as per RFC 4566 Section 5.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 2 - Every line is of the form \'<type>=<value>\'.');
  }
  return errors;
};

// Section 5 Test 3 - check the only letters in use as types are defined in RFC 4566
const test_50_3 = (lines, params) => {
  let errors = [];
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (!letterCheck.test(lines[x])) {
      errors.push(new Error(
        `Line ${x + 1}: Every line of an SDP file must start with a permitted type letter or the line must be ignored, as per RFC 4566 Section 5.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 3 - Every line starts with a permitted type letter.');
  }
  return errors;
};

// Section 5 Test 4 - Check for mandatory types
const test_50_4 = (lines, params) => {
  let errors = [];
  let types = lines.map(x => x.slice(0, 1));
  for ( let x of mustHaves ) {
    if (types.indexOf(x) < 0) {
      errors.push(new Error(`An SDP file must have at least one record of type ${x} as per RFC 4566 Section 5.1.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 4 - Mandatory types are present.');
  }
  return errors;
};

// Section 5 Test 5 - Check the order of the parameters
const test_50_5 = (lines, params) => {
  let errors = [];
  let types = lines.map(x => x.slice(0, 1));
  let state = 'session';
  let nextState = {};
  for ( let x = 1 ; x < types.length ; x++ ) {
    let movingOn = followedBy[state][types[x - 1]];
    nextState = movingOn ? movingOn : nextState;
    if (Object.keys(nextState).indexOf(types[x]) < 0) {
      errors.push(new Error(`Line ${x + 1}: SDP type '${types[x - 1]}' cannot be followed by type '${types[x]}', as per the fixed order of RFC 4566 Section 5.`));
    } else {
      state = nextState[types[x]];
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 5 - Types are in the fixed order.');
  }
  return errors;
};

// Section 5 Test 6 - check no values contain the Nul character
const test_50_6 = (lines, params) => {
  let errors = [];
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].slice(2).indexOf('\u0000') >= 0) {
      errors.push(new Error(`Line ${x + 1}: Value contains illegal Nul (0x00) character not permitted by RFC 4566 Section 5.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 6 - No values contain the Nul character.');
  }
  return errors;
};

// Section 5.1 Test 1 - first line must be v=0
const test_51_1 = (lines, params) => {
  let errors = [];
  if (!lines[0].startsWith('v=0')) {
    errors.push(new Error('Line 1: The first line must be \'v=0\' as per RFC 4566 Section 5.1.'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.1 Test 1 - First line is \'v=0\'.');
  }
  return errors;
};

// Section 5.2 Test 1 - Origin name matches acceptable patterns
const test_52_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('o=')) {
      let oMatch = lines[x].match(oPattern);
      if (!oMatch) {
        errors.push(new Error(`Line ${x + 1}: Origin field ("o=") is not an acceptable pattern, as per RFC 4566 Section 5.2.`));
        continue;
      }
      if (params.useIP4 === true && oMatch[4] === 'IP6') {
        errors.push(new Error(`Line ${x + 1}: Origin field specified an address type of 'IP6' when 'IP4' is requested by configuration.`));
      }
      if (params.useIP6 === true && oMatch[4] === 'IP4') {
        errors.push(new Error(`Line ${x + 1}: Origin field specified an address type of 'IP4' when 'IP6' is requested by configuration.`));
      }
      if (multiPattern.test(oMatch[5])) {
        errors.push(new Error(`Line ${x + 1}: Origin field address of the machine is a multicast address when it must be a unicast address.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.2 Test 1 - Origin field matches an acceptable pattern.');
  }
  return errors;
};

// Section 5.2 Test 2 - Check that the unicast address meets test configuration
const test_52_2 = (sdp, params) => {
  if (!params.useIP4 && !params.useIP6) {
    if (params.verbose) {
      console.log('Test Skipped: RFC 4566 Section 5.2 Test 2 - Origin address uses the IP version requested. Use --useIP4 or --useIP6 to test.');
    }
    return [];
  }
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('o=')) {
      let oMatch = lines[x].match(oPattern);
      if (!oMatch) {
        continue;
      }
      if (params.useIP4 && !ip4Pattern.test(oMatch[5])) {
        errors.push(new Error(`Line ${x + 1}: Origin field address of the machine should use IPv4 as requested by configuration.`));
      }
      if (params.useIP6 && !ip6Pattern.test(oMatch[5])) {
        errors.push(new Error(`Line ${x + 1}: Origin field address of the machine should use IPv6 as requested by configuration.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.2 Test 2 - Origin address uses the IP version requested.');
  }
  return errors;
};

// Section 5.7 Test 1 - Must have c either at session level or for each streams
const test_57_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  let cFound = false;
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('m=')) {
      if (cFound === false && streamCount > 0) {
        errors.push(new Error(`Line ${x + 1}: For stream ${streamCount}, no connection data ("c=") field was found, as per RFC 4566 Section 5.7.`));
      }
      cFound = false;
      streamCount++;
      continue;
    }
    if (lines[x].startsWith('c=')) {
      cFound = true;
      if (streamCount === 0) {
        break;
      }
    }
  }
  if (cFound === false) {
    errors.push(new Error(`Line ${lines.length}: For ${streamCount ? 'stream ' + streamCount : 'all streams'}, no connection data ("c=") field was found, as per RFC 4566 Section 5.7.`));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.7 Test 1 - Connection data is present at session level or for each stream.');
  }
  return errors;
};

// Section 5.7 Test 2 - Must be IN IP4 or IN IP6, and if multicast must have valid TTL
const test_57_2 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('c=')) {
      let cMatch = lines[x].match(cPattern);
      if (!cMatch) {
        errors.push(new Error(`Line ${x + 1}: Connection data field ("c=") is not an acceptable pattern, as per RFC 4566 Section 5.7 and ST 2110-10 Section 6.1.`));
        continue;
      }
      if (params.useIP4 === true && cMatch[1] !== 'IP4') {
        errors.push(new Error(`Line ${x + 1}: Configuration requests IPv4 but connection data field address type is '${cMatch[1]}'.`));
      }
      if (params.useIP6 === true && cMatch[1] !== 'IP6') {
        errors.push(new Error(`Line ${x + 1}: Configuration requests IPv6 but connection data field address type is '${cMatch[1]}'.`));
      }
      let addrMatch = cMatch[2].match(ip4Pattern);
      if (addrMatch) {
        let ip0 = +addrMatch[1];
        if (ip0 >= 224 && ip0 <= 239) { // Entering IPv4 Multicast land
          if (typeof addrMatch[2] === 'undefined') {
            errors.push(new Error(`Line ${x + 1}: Connection data fields using multicast addresses must have a TTL field, as per RFC 4566 Section 5.7.`));
          } else {
            let ttl = +addrMatch[2];
            if (ttl < 0 || ttl > 255) {
              errors.push(new Error(`Line ${x + 1}: Multicast TTL value must be in the range 0-255 and '${ttl}' provided, as per RFC 4566 Section 5.7.`));
            }
            // TODO check length of TTL string ... 0001 should not be acceptable
          }
        }
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.7 Test 2 - Connection data fields are an acceptable pattern, with a TTL for IPv4 multicast.');
  }
  return errors;
};

// Section 5.7 Test 3 - Check is valid address type
const test_57_3 = (sdp, params) => {
  if (!params.useIP4 && !params.useIP6 && !params.multicast && !params.unicast) {
    if (params.verbose) {
      console.log('Test Skipped: RFC 4566 Section 5.7 Test 3 - Connection addresses are the type requested. Use --useIP4, --useIP6, --multicast or --unicast to test.');
    }
    return [];
  }
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('c=')) {
      let addrMatch = lines[x].match(cPattern);
      if (!addrMatch) {
        continue;
      }
      if (params.useIP4 === true) {
        if (!ip4Pattern.test(addrMatch[2])) {
          errors.push(new Error(`Line ${x + 1}: IPv4 addresses requested by configuration and connection data field address '${addrMatch[2]}' is not.`));
        }
      }
      if (params.useIP6 === true) {
        if (!ip6Pattern.test(addrMatch[2])) {
          errors.push(new Error(`Line ${x + 1}: IPv6 addresses requested by configuration and connection data field address '${addrMatch[2]}' is not.`));
        }
      }
      if (params.multicast === true) {
        if (!multiPattern.test(addrMatch[2])) {
          errors.push(new Error(`Line ${x + 1}: Multicast connections requested by configuration and connection data field address '${addrMatch[2]}' is unicast.`));
        }
      }
      if (params.unicast === true) {
        if (multiPattern.test(addrMatch[2])) {
          errors.push(new Error(`Line ${x + 1}: Unicast connections requested by configuration and connection data field address '${addrMatch[2]} is multicast.`));
        }
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.7 Test 3 - Connection addresses are the type requested.');
  }
  return errors;
};
// TODO Future work - test ability to join multicast group or DNS lookup address

// Section 5.8 Test 1 - Bandwidth matches acceptable pattern
const test_58_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('b=') && !bPattern.test(lines[x])) {
      errors.push(new Error(`Line ${x + 1}: Bandwidth field ("b=") is not an acceptable pattern, as per RFC 4566 Section 5.8.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.8 Test 1 - Bandwidth fields match an acceptable pattern.');
  }
  return errors;
};

// Section 5.9 Test 1 - Timing matches acceptable pattern
const test_59_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('t=') && !tPattern.test(lines[x])) {
      errors.push(new Error(`Line ${x + 1}: Timing field ("t=") is not an acceptable pattern, as per RFC 4566 Section 5.9.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.9 Test 1 - Timing fields match an acceptable pattern.');
  }
  return errors;
};

const section_50 = (sdp, params) => {
  let endingTests = [ test50_1, test50_1_1 ];
  let lines = splitLines(sdp);
  let mainTests = [ test_50_2, test_50_3, test_50_4, test_50_5, test_50_6 ];
  return [...endingTests.flatMap(t => t(sdp, params)), ...mainTests.flatMap(t => t(lines, params))];
};

const section_51 = (sdp, params) => {
  let lines = splitLines(sdp);
  return test_51_1(lines, params);
};

const section_52 = (sdp, params) => {
  let tests = [ test_52_1, test_52_2 ];
  return tests.flatMap(t => t(sdp, params));
};

const section_57 = (sdp, params) => {
  let tests = [ test_57_1, test_57_2, test_57_3 ];
  return tests.flatMap(s => s(sdp, params));
};

const section_58 = (sdp, params) => {
  let tests = [ test_58_1 ];
  return tests.flatMap(t => t(sdp, params));
};

const section_59 = (sdp, params) => {
  let tests = [ test_59_1 ];
  return tests.flatMap(t => t(sdp, params));
};

// Test if SDP file is missing media descriptions
const no_media = sdp => {
  let lines = splitLines(sdp.trim());
  let hasMedia = false;
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('m=')) {
      hasMedia = true;
      break;
    }
  }
  return hasMedia ? [] : [ new Error('SDP file does not include any "m=" media attributes.') ];
};

const allSections = (sdp, params) => {
  let sections = [ section_50, section_51, section_52, section_57, section_58, section_59 ];
  if (params.noMedia) {
    sections.push(no_media);
  }
  return sections.flatMap(s => s(sdp, params));
};

module.exports = {
  allSections,
  section_50,
  section_51,
  section_52,
  section_57,
  section_58,
  section_59
};

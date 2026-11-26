/* Copyright 2018 Streampunk Media Ltd.
   Copyright (C) 2019 Advanced Media Workflow Association

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

// Blank lines count in line numbers, and test 1.1 is the only test that reports them
const { splitLines, LineError } = require('./lines.js');

const hasNoNewlineAtEnd = /[^\r\n]$/;
const linePattern = /^([a-z]=\S.*|s= )$/;
// The order of the types of line in RFC 4566 Section 5
const typeOrder = 'vosiuepcbtrzkam';
const typeCheck = new RegExp(`^[${typeOrder}]`);
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
// The state that each type of line leads to, or null if that depends on the state before it
const leadsTo = {};
for (const rows of Object.values(followedBy)) {
  for (const row of Object.values(rows)) {
    for (const [type, next] of Object.entries(row)) {
      leadsTo[type] = leadsTo[type] === undefined || leadsTo[type] === next ? next : null;
    }
  }
}
const oPattern = /^o=(\S+)\s+(\d+)\s+(\d+)\s+IN\s+(IP[46])\s+(\S+)$/;
const cPattern = /^c=IN\s+(IP[46])\s+([^\s/]+)(\/\d+)?(\/[1-9]\d*)?$/;
const bPattern = /^b=[^\s:]+:\d+$/;
const tPattern = /^t=(0|[1-9]\d{9,})\s+(0|[1-9]\d{9,})$/;
const ip4Pattern = /^([1-9]\d?\d?)\.(\d\d?\d?)\.(\d\d?\d?)\.(\d\d?\d?)$/;
// IP6-address = hexpart [ ":" IP4-address ], as per RFC 4566 Section 9
const ip6Pattern = /^([0-9a-f]{1,4}(:[0-9a-f]{1,4})*|([0-9a-f]{1,4}(:[0-9a-f]{1,4})*)?::([0-9a-f]{1,4}(:[0-9a-f]{1,4})*)?)(:\d{1,3}(\.\d{1,3}){3})?$/i;
const multiPattern = /^(((22[4-9]|23[0-9])(\.(\d\d?\d?)){3})|(ff[0-7][123458e]:[0-9a-f:.]*))$/i;

// An IP address must be of the address type before it. A domain name is
// accepted with either address type, and cannot contain ':'.
const addressTypeMismatch = (addrtype, address) => addrtype === 'IP4' ?
  address.includes(':') :
  ip4Pattern.test(address) || (address.includes(':') && !ip6Pattern.test(address));
const addressTypeName = { IP4: 'an IPv4 address', IP6: 'an IPv6 address' };

// Rules of the SDP grammar, as per RFC 8866 Section 9
const token = String.raw`[!#-'*+\-.0-9A-Z^-~]+`;
const integer = String.raw`[1-9]\d*`;
const zeroBasedInteger = `(?:0|${integer})`;
const nonZeroIntOrReal = String.raw`(?:${integer}|${zeroBasedInteger}\.\d*[1-9])`;
const byteString = String.raw`[^\0\r\n]+`;
const nonWsString = String.raw`[^\x00-\x20\x7f]+`;
// This form includes every RFC 5646 Language-Tag
const languageTag = '[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*';
const valuePattern = value => new RegExp(`^(?:${value})$`);
// A non-zero decimal number, which unlike non-zero-int-or-real can have leading or trailing zeros
const paddedNonZeroDecimal = valuePattern(String.raw`(?=.*[1-9])\d+(?:\.\d+)?`);

// Rules of the clock source grammar, as per RFC 7273 Sections 4.8 and 5.4, and Verified erratum 4450,
// in which a PTP domain has no 'domain-name=' or 'domain-nmbr=' prefix
const eui64 = '[0-9A-Fa-f]{2}(?:-[0-9A-Fa-f]{2}){7}';
// A host and optional port, as per RFC 3261 Section 25.1, without checking the form of the host name or address
const hostport = String.raw`(?:[-.0-9A-Za-z]+|\[[.0-9:A-Fa-f]+\])(?::\d+)?`;
const ptpDomain = String.raw`[\x21-\x7e]{1,16}`;
const base64 = '(?:[0-9A-Za-z+/]{4})*(?:[0-9A-Za-z+/]{2}==|[0-9A-Za-z+/]{3}=)?';
// A parameter whose name the grammar defines is checked against that definition, not accepted as an extension
const extension = names => `(?!(?:${names})(?:[=:]|$))${token}(?:=${byteString})?`;
const clockSource = [
  `ntp=(?:${hostport}|/traceable/)`,
  `ptp=${token}:(?:${eui64}(?::${ptpDomain})?|traceable)`,
  'gps', 'gal', 'glonass', 'local', 'private(?::traceable)?',
  extension('ntp|ptp|gps|gal|glonass|local|private')
].join('|');
const mediaClockSource = [
  'sender',
  `direct(?:=\\d+)?(?: rate=${integer}/${integer})?`,
  `IEEE1722=${eui64}`,
  extension('id|sender|direct|IEEE1722')
].join('|');

// The levels at which each attribute is permitted, as registered with IANA, and the
// syntax of its value, or no value for a property attribute. A value that is not that
// syntax but matches 'tolerated' is reported only with --should. Any other value is reported
// with the first of 'forms' that it matches, or with 'form'.
const attributes = {
  'cat': { usage: ['session'], value: valuePattern(nonWsString), form: 'a=cat:<category>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.1' },
  'keywds': { usage: ['session'], value: valuePattern(byteString), form: 'a=keywds:<keywords>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.2' },
  'tool': { usage: ['session'], value: valuePattern(byteString), form: 'a=tool:<name and version of tool>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.3' },
  'ptime': { usage: ['media'], value: valuePattern(nonZeroIntOrReal), form: 'a=ptime:<packet time>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.4',
    tolerated: { value: paddedNonZeroDecimal, message: 'should not have leading or trailing zeros, which RFC 4566 Section 6 does not prohibit but RFC 8866 Section 6.4 does' } },
  'maxptime': { usage: ['media'], value: valuePattern(nonZeroIntOrReal), form: 'a=maxptime:<maximum packet time>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.5',
    tolerated: { value: paddedNonZeroDecimal, message: 'should not have leading or trailing zeros, which RFC 4566 Section 6 does not prohibit but RFC 8866 Section 6.5 does' } },
  'rtpmap': { usage: ['media'], value: valuePattern(`${zeroBasedInteger} ${token}/${integer}(?:/${integer})?`), form: 'a=rtpmap:<payload type> <encoding name>/<clock rate>[/<encoding parameters>]', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.6' },
  'recvonly': { usage: ['session', 'media'], form: 'a=recvonly', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.7.1' },
  'sendrecv': { usage: ['session', 'media'], form: 'a=sendrecv', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.7.2' },
  'sendonly': { usage: ['session', 'media'], form: 'a=sendonly', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.7.3' },
  'inactive': { usage: ['session', 'media'], form: 'a=inactive', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.7.4' },
  'orient': { usage: ['media'], value: valuePattern('portrait|landscape|seascape'), form: 'a=orient:<orientation>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.8' },
  'type': { usage: ['session'], value: valuePattern('broadcast|meeting|moderated|test|H332'), form: 'a=type:<conference type>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.9' },
  // A charset name is a MIME parameter value, as per RFC 2978 Section 2.3, which without quotes is a token
  'charset': { usage: ['session'], value: valuePattern(token), form: 'a=charset:<character set>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.10' },
  'sdplang': { usage: ['session', 'media'], value: valuePattern(languageTag), form: 'a=sdplang:<language tag>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.11' },
  'lang': { usage: ['session', 'media'], value: valuePattern(languageTag), form: 'a=lang:<language tag>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.12' },
  'framerate': { usage: ['media'], value: valuePattern(nonZeroIntOrReal), form: 'a=framerate:<frame rate>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.13' },
  'quality': { usage: ['media'], value: valuePattern(zeroBasedInteger), form: 'a=quality:<quality>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.14' },
  'fmtp': { usage: ['media'], value: valuePattern(`${token} ${byteString}`), form: 'a=fmtp:<format> <format specific parameters>', specification: 'RFC 4566 Section 6 and RFC 8866 Section 6.15',
    tolerated: { value: valuePattern(`${token} ?`), message: 'should not be empty, so it should be omitted when there are no format specific parameters, as per RFC 4566 Section 6 and RFC 8866 Section 6.15' } },
  'ts-refclk': { usage: ['session', 'media'], value: valuePattern(clockSource), form: 'a=ts-refclk:<clock source>', specification: 'RFC 7273 Section 4.8',
    forms: [
      { value: /^ptp=traceable$/, form: 'a=ts-refclk:ptp=<ptp version>:traceable', note: 'An example in the first published ST 2110-10 omits the PTP version' },
      { value: /^ptp=/, form: 'a=ts-refclk:ptp=<ptp version>:<ptp gmid>[:<ptp domain>]\' or \'a=ts-refclk:ptp=<ptp version>:traceable' }
    ] },
  'mediaclk': { usage: ['session', 'media'], value: valuePattern(`(?:id=(?:src:)?${base64} )?(?:${mediaClockSource})`), form: 'a=mediaclk:[id=<media clock identifier> ]<media clock source>', specification: 'RFC 7273 Section 5.4',
    forms: [
      { value: /^(?:id=\S* +)?direct(?:[= ]|$)/, form: 'a=mediaclk:[id=<media clock identifier> ]direct[=<offset>][ rate=<numerator>/<denominator>]' }
    ] },
  'group': { usage: ['session'], value: valuePattern(`${token}(?: ${token})*`), form: 'a=group:<semantics>[ <identification tag>]*', specification: 'RFC 5888 Section 5' },
  'mid': { usage: ['media'], value: valuePattern(token), form: 'a=mid:<identification tag>', specification: 'RFC 5888 Section 4' },
  'ssrc': { usage: ['media'], value: valuePattern(`${zeroBasedInteger} ${token}(?::${byteString})?`), form: 'a=ssrc:<ssrc-id> <attribute>[:<value>]', specification: 'RFC 5576 Section 4.1' },
  'ssrc-group': { usage: ['media'], value: valuePattern(`${token}(?: ${zeroBasedInteger})*`), form: 'a=ssrc-group:<semantics>[ <ssrc-id>]*', specification: 'RFC 5576 Section 4.2' },
  // Only the 'IN' network type and its address types are accepted, not any token as in the grammar of RFC 4570
  'source-filter': { usage: ['session', 'media'], value: valuePattern(String.raw` (?:incl|excl) IN (?:IP4|IP6|\*) ${nonWsString}(?: ${nonWsString})+`),
    form: 'a=source-filter: <filter-mode> <filter-spec>', specification: 'RFC 4570 Section 3' },
  // A space separates the port and the network type, as per RFC 3605 Verified erratum 1050
  // The connection address is not checked, except that it has no whitespace
  'rtcp': { usage: ['media'], value: valuePattern(String.raw`\d+(?: ${token} ${token} ${nonWsString})?`),
    form: 'a=rtcp:<port>[ <network type> <address type> <connection address>]', specification: 'RFC 3605 Section 2.1' },
  'duplication-delay': { usage: ['session', 'media'], value: valuePattern(String.raw`\d+(?: \d+)*`), form: 'a=duplication-delay:<period>[ <period>]*', specification: 'RFC 7197 Section 3' },
  // The extension name is an absolute URI, as per RFC 3986 Section 4.3, but only its scheme is checked
  'extmap': { usage: ['session', 'media'],
    value: valuePattern(String.raw`\d{1,5}(?:/(?:sendonly|recvonly|sendrecv|inactive))? [A-Za-z][-+.0-9A-Za-z]*:[^\x00-\x20\x7f]*(?: ${byteString})?`),
    form: 'a=extmap:<value>[/<direction>] <URI>[ <extension attributes>]', specification: 'RFC 8285 Section 8' }
};
const attributePattern = /^a=([^:]*)(?::(.*))?$/;
const attributeNamePattern = new RegExp(`^${token}$`);

// Whether an attribute line has a token as its name, and is not one of the attributes above, or has a value of the syntax of that attribute
const isAcceptableAttribute = line => {
  let [, name, value] = line.match(attributePattern) ?? [];
  if (!attributeNamePattern.test(name)) {
    return false;
  }
  if (!Object.hasOwn(attributes, name)) {
    return true;
  }
  let pattern = attributes[name].value;
  return pattern ? value !== undefined && pattern.test(value) : value === undefined;
};

const rtpmapPattern = /^a=rtpmap:(\d+)\s+([^\s/]+)\/(\d+)(?:\/(\S+))?$/;
// A name with no value is allowed, because payload format registrations such as RFC 4175 define them, and whitespace
// after a semicolon and a semicolon after the last parameter are allowed, because the ST 2110 specifications disagree about them
const fmtpElement = '([^\\s=;]+)(?:=([^\\s;]+))?';
const fmtpSeparator = '(?:;\\s*)';
const fmtpListPattern = new RegExp('^a=fmtp:(\\d+)\\s*(\\s' + fmtpElement + '(' + fmtpSeparator + fmtpElement + ')*' + fmtpSeparator + '?)?$');
const fmtpParams = new RegExp(fmtpElement + fmtpSeparator + '?', 'g');
// Format parameters that can be specified more than once, such as DID_SDID as per RFC 8331 Section 4.
// extractStreams returns each one that is present as an array of its values, even if it is specified only once.
const repeatableParams = ['DID_SDID'];

// The media descriptions, numbered in order, each with the media type, port, transport protocol and formats of its media
// field, as per RFC 4566 Section 5.14, the encoding names of its RTP payload types that have an 'rtpmap' attribute, and its
// 'fmtp' attributes. An 'fmtp' attribute that is not a list of format specific parameters has no format or parameters.
const extractStreams = sdp => {
  let streams = [];
  let lines = splitLines(sdp);
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      let [mediaType, port, proto, ...formats] = lines[x].slice(2).trim().split(/\s+/);
      streams.push({ streamNumber: streams.length + 1, line: x + 1, mediaType, port: parseInt(port), proto, formats, encodingNames: {}, fmtp: [] });
      continue;
    }
    let stream = streams[streams.length - 1];
    if (!stream) {
      continue;
    }
    if (lines[x].startsWith('a=rtpmap')) {
      let rtpmapMatch = lines[x].match(rtpmapPattern);
      if (rtpmapMatch) {
        stream.encodingNames[rtpmapMatch[1]] = rtpmapMatch[2];
      }
    } else if (lines[x].startsWith('a=fmtp')) {
      let fmtpMatch = lines[x].match(fmtpListPattern);
      if (!fmtpMatch) {
        stream.fmtp.push({ line: x + 1 });
        continue;
      }
      let fmtParams = lines[x].split(/a=fmtp:\S+\s+/)[1];
      let paramsMatch = [];
      let paramMatch;
      while ((paramMatch = fmtpParams.exec(fmtParams)) !== null)
        paramsMatch.push(paramMatch);
      let splitParams = paramsMatch.map(p => [p[1], p[2] || '']);
      let params = splitParams.reduce((x, y) => {
        x[y[0]] = repeatableParams.includes(y[0]) ? [...(x[y[0]] ?? []), y[1]] : y[1];
        return x;
      }, {});
      stream.fmtp.push({ format: fmtpMatch[1], line: x + 1, names: splitParams.map(p => p[0]), params });
    }
  }
  return streams;
};

// RFC 4566 Section 5 Test 1 - Line endings are all CRLF
const test50_1 = (sdp, params) => {
  if (!params.checkEndings) {
    if (params.verbose) {
      console.log('Test Skipped: RFC 4566 Section 5 Test 1 - Line endings are all CRLF. Use --checkEndings to test.');
    }
    return [];
  }
  let errors = [];
  const badEnding = (sdp.match(/\r\n|\r|\n/g) ?? []).findIndex(ending => ending !== '\r\n');
  if (badEnding >= 0) {
    errors.push(new LineError(badEnding + 1, 'Every record of an SDP file must end with CRLF (0x0d0a), and CR and LF must not appear separately, as per RFC 4566 Section 5.'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 1 - Line endings are all CRLF.');
  }
  return errors;
};

// RFC 4566 Section 5 Test 1.1 - Last record ends with a newline and there are no blank lines
const test50_1_1 = (sdp, params) => {
  let errors = [];
  if (hasNoNewlineAtEnd.test(sdp)) {
    errors.push(new LineError(splitLines(sdp).length, 'The last record of an SDP file must end with a newline character, as per RFC 4566 Section 5.'));
  }
  const blankLine = splitLines(sdp).indexOf('');
  if (blankLine >= 0) {
    errors.push(new LineError(blankLine + 1, 'An SDP file must not contain blank lines, as per RFC 4566 Section 5.'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 1.1 - Last record ends with a newline and there are no blank lines.');
  }
  return errors;
};

// RFC 4566 Section 5 Test 2 - Every line is of the form '<type>=<value>'
const test_50_2 = (lines, params) => {
  let errors = [];
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x] !== '' && !linePattern.test(lines[x])) {
      errors.push(new LineError(x + 1,
        'Every line of an SDP file must be of the form \'<type>=<value>\' with <type> being one character and no whitespace either side of the equals, as per RFC 4566 Section 5.'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 2 - Every line is of the form \'<type>=<value>\'.');
  }
  return errors;
};

// RFC 4566 Section 5 Test 3 - Every line starts with a permitted type letter
const test_50_3 = (lines, params) => {
  let errors = [];
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x] !== '' && !typeCheck.test(lines[x])) {
      errors.push(new LineError(x + 1,
        'Every line of an SDP file must start with a permitted type letter, as per RFC 4566 Section 5.'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 3 - Every line starts with a permitted type letter.');
  }
  return errors;
};

// RFC 4566 Section 5 Test 4 - Required lines are present
const test_50_4 = (lines, params) => {
  let errors = [];
  let types = lines.map(x => x.slice(0, 1));
  for ( let x of mustHaves ) {
    if (types.indexOf(x) < 0) {
      // Report the first line of a type that must come after the missing type
      const after = typeOrder.slice(typeOrder.indexOf(x) + 1);
      const line = types.findIndex(type => type !== '' && after.includes(type)) + 1 || lines.length;
      errors.push(new LineError(line, `An SDP file must have at least one line of type '${x}', as per RFC 4566 Section 5.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 4 - Required lines are present.');
  }
  return errors;
};

// RFC 4566 Section 5 Test 5 - Lines are in the required order
const test_50_5 = (lines, params) => {
  let errors = [];
  let types = lines.map(x => x.slice(0, 1));
  let state = 'session';
  let nextState = {};
  let previous = types.findIndex(type => type !== '');
  for ( let x = previous + 1 ; x < types.length ; x++ ) {
    if (types[x] === '') {
      continue;
    }
    let movingOn = followedBy[state][types[previous]];
    nextState = movingOn ? movingOn : nextState;
    if (Object.keys(nextState).indexOf(types[x]) < 0) {
      errors.push(new LineError(x + 1, `A line of type '${types[previous]}' must not be followed by a line of type '${types[x]}', as per RFC 4566 Section 5.`));
      state = leadsTo[types[x]] ?? state;
    } else {
      state = nextState[types[x]];
    }
    previous = x;
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 5 - Lines are in the required order.');
  }
  return errors;
};

// RFC 4566 Section 5 Test 6 - No values contain the Nul character
const test_50_6 = (lines, params) => {
  let errors = [];
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].slice(2).indexOf('\u0000') >= 0) {
      errors.push(new LineError(x + 1, 'A value must not contain the Nul (0x00) character, as per RFC 4566 Section 5.'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5 Test 6 - No values contain the Nul character.');
  }
  return errors;
};

// RFC 4566 Section 5.1 Test 1 - First line is 'v=0'
const test_51_1 = (lines, params) => {
  let errors = [];
  let first = Math.max(lines.findIndex(line => line !== ''), 0);
  if (!lines[first].startsWith('v=0')) {
    errors.push(new LineError(first + 1, 'The first line must be \'v=0\', as per RFC 4566 Section 5.1.'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.1 Test 1 - First line is \'v=0\'.');
  }
  return errors;
};

// RFC 4566 Section 5.2 Test 1 - Origin field matches an acceptable pattern
const test_52_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('o=')) {
      let oMatch = lines[x].match(oPattern);
      if (!oMatch) {
        errors.push(new LineError(x + 1, 'Origin field (\'o=\') is not an acceptable pattern, as per RFC 4566 Section 5.2.'));
        continue;
      }
      if (addressTypeMismatch(oMatch[4], oMatch[5])) {
        errors.push(new LineError(x + 1, `Origin field ('o=') address '${oMatch[5]}' must be ${addressTypeName[oMatch[4]]} to match address type '${oMatch[4]}', as per RFC 4566 Section 5.2.`));
      }
      if (multiPattern.test(oMatch[5])) {
        errors.push(new LineError(x + 1, `Origin field ('o=') address '${oMatch[5]}' must be a unicast address, as per RFC 4566 Section 5.2.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.2 Test 1 - Origin field matches an acceptable pattern.');
  }
  return errors;
};

// RFC 4566 Section 5.2 Test 2 - Origin address uses the IP version requested
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
      if (params.useIP4 && (oMatch[4] !== 'IP4' || !ip4Pattern.test(oMatch[5]))) {
        errors.push(new LineError(x + 1, `Origin field ('o=') address '${oMatch[5]}' must be an IPv4 address, as requested by --useIP4.`));
      }
      if (params.useIP6 && (oMatch[4] !== 'IP6' || !ip6Pattern.test(oMatch[5]))) {
        errors.push(new LineError(x + 1, `Origin field ('o=') address '${oMatch[5]}' must be an IPv6 address, as requested by --useIP6.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.2 Test 2 - Origin address uses the IP version requested.');
  }
  return errors;
};

// RFC 4566 Section 5.7 Test 1 - Connection data is present at session level or for each stream
const test_57_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  let cFound = false;
  let mediaLine = 0;
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('m=')) {
      if (cFound === false && streamCount > 0) {
        errors.push(new LineError(mediaLine, `For stream ${streamCount}, a connection data field ('c=') must be present, as per RFC 4566 Section 5.7.`));
      }
      cFound = false;
      streamCount++;
      mediaLine = x + 1;
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
    errors.push(streamCount ?
      new LineError(mediaLine, `For stream ${streamCount}, a connection data field ('c=') must be present, as per RFC 4566 Section 5.7.`) :
      new LineError(lines.length, 'A connection data field (\'c=\') must be present at session level, as per RFC 4566 Section 5.7.'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.7 Test 1 - Connection data is present at session level or for each stream.');
  }
  return errors;
};

// RFC 4566 Section 5.7 Test 2 - Connection data fields are an acceptable pattern, with a TTL for IPv4 multicast
const test_57_2 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('c=')) {
      let cMatch = lines[x].match(cPattern);
      if (!cMatch) {
        errors.push(new LineError(x + 1, 'Connection data field (\'c=\') is not an acceptable pattern, as per RFC 4566 Section 5.7.'));
        continue;
      }
      if (addressTypeMismatch(cMatch[1], cMatch[2])) {
        errors.push(new LineError(x + 1, `Connection data field ('c=') address '${cMatch[2]}' must be ${addressTypeName[cMatch[1]]} to match address type '${cMatch[1]}', as per RFC 4566 Section 5.7.`));
        continue;
      }
      let addrMatch = cMatch[2].match(ip4Pattern);
      if (addrMatch) {
        let ip0 = +addrMatch[1];
        if (ip0 >= 224 && ip0 <= 239) { // Entering IPv4 Multicast land
          if (typeof cMatch[3] === 'undefined') {
            errors.push(new LineError(x + 1, 'A connection data field (\'c=\') with an IPv4 multicast address must have a TTL value, as per RFC 4566 Section 5.7.'));
          } else {
            let ttl = cMatch[3].slice(1);
            if (!/^(0|[1-9]\d{0,2})$/.test(ttl) || +ttl > 255) {
              errors.push(new LineError(x + 1, `Multicast TTL value must be an integer in the range 0 to 255 inclusive without leading zeros, but is '${ttl}', as per RFC 4566 Section 5.7.`));
            }
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

// RFC 4566 Section 5.7 Test 3 - Connection addresses are the type requested
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
        if (addrMatch[1] !== 'IP4' || !ip4Pattern.test(addrMatch[2])) {
          errors.push(new LineError(x + 1, `Connection data field ('c=') address '${addrMatch[2]}' must be an IPv4 address, as requested by --useIP4.`));
        }
      }
      if (params.useIP6 === true) {
        if (addrMatch[1] !== 'IP6' || !ip6Pattern.test(addrMatch[2])) {
          errors.push(new LineError(x + 1, `Connection data field ('c=') address '${addrMatch[2]}' must be an IPv6 address, as requested by --useIP6.`));
        }
      }
      if (params.multicast === true) {
        if (!multiPattern.test(addrMatch[2])) {
          errors.push(new LineError(x + 1, `Connection data field ('c=') address '${addrMatch[2]}' must be a multicast address, as requested by --multicast.`));
        }
      }
      if (params.unicast === true) {
        if (multiPattern.test(addrMatch[2])) {
          errors.push(new LineError(x + 1, `Connection data field ('c=') address '${addrMatch[2]}' must be a unicast address, as requested by --unicast.`));
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

// RFC 4566 Section 5.8 Test 1 - Bandwidth fields match an acceptable pattern
const test_58_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('b=') && !bPattern.test(lines[x])) {
      errors.push(new LineError(x + 1, 'Bandwidth field (\'b=\') is not an acceptable pattern, as per RFC 4566 Section 5.8.'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.8 Test 1 - Bandwidth fields match an acceptable pattern.');
  }
  return errors;
};

// RFC 4566 Section 5.9 Test 1 - Timing fields match an acceptable pattern
const test_59_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('t=') && !tPattern.test(lines[x])) {
      errors.push(new LineError(x + 1, 'Timing field (\'t=\') is not an acceptable pattern, as per RFC 4566 Section 5.9.'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 5.9 Test 1 - Timing fields match an acceptable pattern.');
  }
  return errors;
};

// RFC 4566 Section 6 Test 1 - Attributes are at a level at which they are permitted
const test_60_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('m=')) {
      streamCount++;
      continue;
    }
    let name = lines[x].match(attributePattern)?.[1];
    if (!Object.hasOwn(attributes, name)) {
      continue;
    }
    let { usage, specification } = attributes[name];
    if (streamCount === 0 && !usage.includes('session')) {
      errors.push(new LineError(x + 1, `Attribute '${name}' must be a media-level attribute, as per ${specification}.`));
    } else if (streamCount > 0 && !usage.includes('media')) {
      errors.push(new LineError(x + 1, `For stream ${streamCount}, attribute '${name}' must be a session-level attribute, as per ${specification}.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 6 Test 1 - Attributes are at a level at which they are permitted.');
  }
  return errors;
};

// RFC 4566 Section 6 Test 2 - Attributes match an acceptable pattern
const test_60_2 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  for ( let x = 0 ; x < lines.length ; x++ ) {
    if (lines[x].startsWith('m=')) {
      streamCount++;
      continue;
    }
    if (lines[x].startsWith('a=') && !isAcceptableAttribute(lines[x])) {
      let [, name, value] = lines[x].match(attributePattern);
      let attribute = streamCount ? `For stream ${streamCount}, attribute` : 'Attribute';
      if (!attributeNamePattern.test(name)) {
        // A line that is not of the form '<type>=<value>' is reported by RFC 4566 Section 5 Test 2
        if (linePattern.test(lines[x])) {
          errors.push(new LineError(x + 1, `${attribute} name '${name}' must be a token, as per RFC 4566 Section 9.`));
        }
        continue;
      }
      let { form, forms = [], specification, tolerated } = attributes[name];
      if (tolerated && value !== undefined && tolerated.value.test(value)) {
        if (params.should) {
          errors.push(new LineError(x + 1, `${attribute} '${name}' ${tolerated.message}.`));
        }
        continue;
      }
      let known = forms.find(f => value !== undefined && f.value.test(value)) ?? { form };
      errors.push(new LineError(x + 1, `${attribute} '${name}' is not an acceptable pattern, which must be of the form '${known.form}', as per ${specification}.${known.note ? ` ${known.note}.` : ''}`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 4566 Section 6 Test 2 - Attributes match an acceptable pattern.');
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

const section_60 = (sdp, params) => {
  let tests = [ test_60_1, test_60_2 ];
  return tests.flatMap(t => t(sdp, params));
};

const allSections = (sdp, params) => {
  let sections = [ section_50, section_51, section_52, section_57, section_58, section_59, section_60 ];
  return sections.flatMap(s => s(sdp, params));
};

module.exports = {
  allSections,
  section_50,
  section_51,
  section_52,
  section_57,
  section_58,
  section_59,
  section_60,
  isAcceptableAttribute,
  extractStreams,
  rtpmapPattern,
  fmtpElement,
  fmtpSeparator,
  repeatableParams
};

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

const { splitLines, LineError } = require('./lines.js');
const { isAcceptableAttribute, extractStreams, rtpmapPattern, fmtpElement, fmtpSeparator, repeatableParams } = require('./checkRFC4566.js');

const mediaclkPattern = /[\r\n]a=mediaclk/;
const mediaclkTypePattern = /^a=mediaclk:(?:id=\S+\s+)?([^\s=]+)/;
const mediaclkDirectPattern = /[\r\n]a=mediaclk:(?:id=\S+\s+)?direct=(\d+)/g;
const mediaclkNoOffsetPattern = /[\r\n]a=mediaclk:(?:id=\S+\s+)?direct(\s|$)/;
const tsrefclkPattern = /[\r\n]a=ts-refclk/;
const ptpPattern = /^(?:traceable|([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){7})(?::(.+))?)$/;
const ptpVersions = ['IEEE1588-2002', 'IEEE1588-2008', 'IEEE802.1AS-2011'];
// The 'ts-refclk' forms of RFC 7273 Section 4.8 other than 'ptp', for devices not referenced to IEEE 1588-2008
const otherRefclkPattern = /^a=ts-refclk:(?:ntp=(?:\/traceable\/|[^\s/]+)|gps|gal|glonass|local|private(?::traceable)?)$/;
const macPattern = /^(([0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2})$/;
const dupPattern = /[\r\n]m=[\s\S]+a=ssrc-group:DUP|[\r\n]a=group:DUP[\s\S]+m=/;
const ssrcGroupPattern = /a=ssrc-group:DUP\s+(\d+)\s+(\d+)/;
const groupPattern = /a=group:DUP\s+(\S+)\s+(\S+)/;
const ssrcPattern = /^a=ssrc:(\d+)/;
const videoPattern = /video\s+(\d+)(\/\d+)?\s+(RTP\/S?AVP)\s+(\d+)/;
const bandwidthPattern = /b=([a-zA-Z]+):(\d+$)/;
const fmtpPattern = new RegExp('a=fmtp:(\\d+)\\s*(\\s' + fmtpElement + '(' + fmtpSeparator + fmtpElement + ')*' + fmtpSeparator + '?)?$');
const codecsPattern = /[\s;]codecs=([^\s;]+)/i;
const charsetPattern = /[\s;]charset(?:=([^\s;]*))?(?=[\s;]|$)/i;
const profilePattern = /[\s;]profile(?:=([^\s;]*))?(?=[\s;]|$)/i;
const integerPattern = /^[1-9]\d*$/;
const frameRatePattern = /^([1-9]\d*)(?:\/([1-9]\d*))?$/;
const parPattern = /^([1-9]\d*):([1-9]\d*)$/;
const rtpmapSound = /a=rtpmap:(\d+)\s+(L16|L24)\/([1-9]\d*)\/([1-9]\d*)/;
const rtpmapAM824 = /^a=rtpmap:(\d+)\s+(AM824)\/([1-9]\d*)\/([1-9]\d*)$/;
const cPattern = /^c=IN\s+(IP[46])\s+([^\s/]+)(\/\d+)?(\/[1-9]\d*)?$/;
const multiPattern = /^(((22[4-9]|23[0-9])(\.(\d\d?\d?)){3})|(ff[0-7][123458e]:[0-9a-f:.]*))$/i;
// Source-specific multicast addresses are 232/8 and FF3x::/32, as per RFC 4607 Section 1
const ssmPattern = /^((232(\.(\d\d?\d?)){3})|(ff3[0-9a-f]:(0{1,4})?:[0-9a-f:.]*))$/i;
const sourceFilterPattern = /^a=source-filter:\s(incl|excl)\sIN\s(IP4|IP6|\*)\s(\S+)(?:\s(\S+))+$/;
const ptimePattern = /^a=ptime:(\d+(?:\.\d+)?)$/;
const audioPattern = /audio\s+(\d+)(\/\d+)?\s+(RTP\/S?AVP)\s+(\d+)/;
const mediaPattern = /(audio|video|application)\s+(\d+)(\/\d+)?\s+(RTP\/S?AVP)\s+(\d+)/;
const channelOrderPattern = /^a=fmtp:(\d+)\s+.*channel-order=([^\s;]+).*$/;
const smpteChannelSymbols30 = 'M|DM|ST|LtRt|51|71|222|SGRP|U\\d\\d';
const smpteChannelSymbols31 = smpteChannelSymbols30 + '|AES3';
const smpteChannelPattern =
  new RegExp('^SMPTE2110\\.\\((' + smpteChannelSymbols30 + ')(,(' + smpteChannelSymbols30 + '))*\\)$');
const smpteChannelPattern31 =
  new RegExp('^SMPTE2110\\.\\((' + smpteChannelSymbols31 + ')(,(' + smpteChannelSymbols31 + '))*\\)$');
// Skip the following 'video' media types until we have more complete validation for them
const skipVideoTypes = ['vc2'];

// Example SDP data from ST 2110-10 Annex B
const specExample20 = `v=0
o=- 123456 11 IN IP4 192.168.100.2
s=Example of a SMPTE ST2110-20 signal
i=this example is for 720p video at 59.94
t=0 0
a=recvonly
a=group:DUP primary secondary
m=video 50000 RTP/AVP 112
c=IN IP4 239.100.9.10/32
a=source-filter:incl IN IP4 239.100.9.10 192.168.100.2
a=rtpmap:112 raw/90000
a=fmtp:112 sampling=YCbCr-4:2:2; width=1280; height=720; exactframerate=60000/1001; depth=10; TCS=SDR; colorimetry=BT709; PM=2110GPM; SSN=ST2110-20:2017;
a=ts-refclk:ptp=IEEE1588-2008:39-A7-94-FF-FE-07-CB-D0:37
a=mediaclk:direct=0
a=mid:primary
m=video 50020 RTP/AVP 112
c=IN IP4 239.101.9.10/32
a=source-filter:incl IN IP4 239.101.9.10 192.168.101.2
a=rtpmap:112 raw/90000
a=fmtp:112 sampling=YCbCr-4:2:2; width=1280; height=720; exactframerate=60000/1001; depth=10; TCS=SDR; colorimetry=BT709; PM=2110GPM; SSN=ST2110-20:2017;
a=ts-refclk:ptp=IEEE1588-2008:39-A7-94-FF-FE-07-CB-D0:37
a=mediaclk:direct=0
a=mid:secondary
`;

// Example SDP data from ST 2110-10:2022 Annex B
const specExample20_2022 = `v=0
o=- 123456 11 IN IP4 192.168.100.2
s=Example of a SMPTE ST2110-20 signal
i=this example is for 720p video at 59.94
t=0 0
a=recvonly
a=group:DUP primary secondary
m=video 50000 RTP/AVP 112
c=IN IP4 239.100.9.10/32
a=source-filter: incl IN IP4 239.100.9.10 192.168.100.2
a=rtpmap:112 raw/90000
a=fmtp:112 sampling=YCbCr-4:2:2; width=1280; height=720; exactframerate=60000/1001; depth=10; TCS=SDR; colorimetry=BT709; PM=2110GPM; SSN=ST2110-20:2017; TSMODE=SAMP; TSDELAY=0
a=ts-refclk:ptp=IEEE1588-2008:39-A7-94-FF-FE-07-CB-D0:37
a=mediaclk:direct=0
a=mid:primary
m=video 50020 RTP/AVP 112
c=IN IP4 239.101.9.10/32
a=source-filter: incl IN IP4 239.101.9.10 192.168.101.2
a=rtpmap:112 raw/90000
a=fmtp:112 sampling=YCbCr-4:2:2; width=1280; height=720; exactframerate=60000/1001; depth=10; TCS=SDR; colorimetry=BT709; PM=2110GPM; SSN=ST2110-20:2017; TSMODE=SAMP; TSDELAY=0
a=ts-refclk:ptp=IEEE1588-2008:39-A7-94-FF-FE-07-CB-D0:37
a=mediaclk:direct=0
a=mid:secondary
`;

// Example SDP data from VSF TR-08:2022 Appendix A
// See https://videoservicesforum.com/download/technical_recommendations/VSF_TR-08_2022-04-20.pdf
// NOTE: this example in this revision of TR-08 still has some syntax errors (b= lines are in wrong position, and the sampling and level values do not use the correct '-' character)
const specExample22 = `v=0
o=- 101202 53 IN IP4 10.0.81.54
s=237.0.0.50:22000
i=Nmos Testing 237.0.0.50:22000
t=0 0
a=recvonly
a=group:DUP PRIMARY SECONDARY
m=video 22000 RTP/AVP 98
c=IN IP4 237.0.0.50/32
a=source-filter: incl IN IP4 237.0.0.50 10.0.81.54
a=rtpmap:98 jxsv/90000
a=fmtp:98 sampling=YCbCr-4:2:2;width=1280;height=720;packetmode=0;exactframerate=60000/1001;depth=10;TCS=SDR;colorimetry=BT709;SSN=ST2110-22:2019;TP=2110TPN;level=1k-1;sublevel=Sublev3bpp
b=AS:116000
a=ssrc:0 cname:nmos@nmos.tv
a=ts-refclk:ptp=IEEE1588-2008:08-00-11-FF-FE-22-91-3C:127
a=mediaclk:direct=0
a=mid:PRIMARY
m=video 22000 RTP/AVP 98
c=IN IP4 237.64.0.50/32
a=source-filter: incl IN IP4 237.64.0.50 10.0.81.154
a=rtpmap:98 jxsv/90000
a=fmtp:98 sampling=YCbCr-4:2:2;width=1280;height=720;packetmode=0;exactframerate=60000/1001;depth=10;TCS=SDR;colorimetry=BT709;SSN=ST2110-22:2019;TP=2110TPN;level=1k-1;sublevel=Sublev3bpp
b=AS:116000
a=ssrc:0 cname:nmos@nmos.tv
a=ts-refclk:ptp=IEEE1588-2008:08-00-11-FF-FE-22-91-3C:127
a=mediaclk:direct=0
a=mid:SECONDARY
`;

// NOTE: all ST 2110 references are for the originally published specifications unless a later revision is indicated

// ST 2110-10 Section 7.4 Test 1 - Where attribute 'mediaclk' uses the direct reference, the offset is included and is zero
// [also ST 2110-10:2022 Sections 7.3 and 8.3]
const test_10_74_1 = (sdp, params) => {
  let errors = [];
  let streams = sdp.split(/[\r\n]m=/).slice(1);
  let mediaLines = splitLines(sdp).flatMap((line, x) => line.startsWith('m=') ? [x + 1] : []);
  for (let s = 0; s < streams.length; s++) {
    if (mediaclkNoOffsetPattern.test(streams[s])) {
      errors.push(new LineError(mediaLines[s], `For stream ${s + 1}, the 'mediaclk' attribute shall include a zero offset when the media clock is directly referenced, as per ST 2110-10 Section 7.4 [also ST 2110-10:2022 Sections 7.3 and 8.3].`));
    }
    for (let offsetMatch of streams[s].matchAll(mediaclkDirectPattern)) {
      if (+offsetMatch[1] !== 0) {
        errors.push(new LineError(mediaLines[s], `For stream ${s + 1}, the 'mediaclk' attribute shall have a zero offset, but has '${offsetMatch[1]}', when the media clock is directly referenced, as per ST 2110-10 Section 7.4 [also ST 2110-10:2022 Sections 7.3 and 8.3].`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 7.4 [also ST 2110-10:2022 Sections 7.3 and 8.3] Test 1 - Where attribute \'mediaclk\' uses the direct reference, the offset is included and is zero.');
  }
  return errors;
};

// ST 2110-10 Section 8.1 Test 1 - Every stream has a media-level 'mediaclk' attribute
// [also ST 2110-10:2022 Section 8.3]
const test_10_81_1 = (sdp, params) => {
  let errors = [];
  let streams = sdp.split(/[\r\n]m=/).slice(1);
  let mediaLines = splitLines(sdp).flatMap((line, x) => line.startsWith('m=') ? [x + 1] : []);
  for (let s = 0; s < streams.length; s++) {
    if (!mediaclkPattern.test(streams[s])) {
      errors.push(new LineError(mediaLines[s], `For stream ${s + 1}, the media description shall have a 'mediaclk' attribute, as per ST 2110-10 Section 8.1 [also ST 2110-10:2022 Section 8.3].`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 8.1 [also ST 2110-10:2022 Section 8.3] Test 1 - Every stream has a media-level \'mediaclk\' attribute.');
  }
  return errors;
};

// ST 2110-10 Section 8.1 Test 2 - Attribute 'mediaclk' uses the direct reference
// Only the sender reference is reported, because ST 2110-10:2022 Section 8.3 Test 1 reports any other
const test_10_81_2 = (sdp, params) => {
  if (!params.should) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-10 Section 8.1 Test 2 - Attribute \'mediaclk\' uses the direct reference. Use --should to test.');
    }
    return [];
  }
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      streamCount++;
      continue;
    }
    let typeMatch = lines[x].match(mediaclkTypePattern);
    if (typeMatch && typeMatch[1] === 'sender') {
      errors.push(new LineError(x + 1, `For ${streamCount ? 'stream ' + streamCount : 'all streams'}, attribute 'mediaclk' should use the 'direct' reference, not 'sender', as per ST 2110-10 Section 8.1.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 8.1 Test 2 - Attribute \'mediaclk\' uses the direct reference.');
  }
  return errors;
};

// ST 2110-10 Section 8.1 Test 3 - Attribute 'mediaclk' has no media clock identifier
// RFC 7273 allows a media clock identifier, but with --should SDPoker reports one, because receivers might not support it.
// RFC 4566 Section 6 Test 2 checks that attribute 'mediaclk' matches an acceptable pattern
const test_10_81_3 = (sdp, params) => {
  if (!params.should) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-10 Section 8.1 Test 3 - Attribute \'mediaclk\' has no media clock identifier. Use --should to test.');
    }
    return [];
  }
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      streamCount++;
      continue;
    }
    if (lines[x].startsWith('a=mediaclk:id=')) {
      errors.push(new LineError(x + 1, `For ${streamCount ? 'stream ' + streamCount : 'all streams'}, attribute 'mediaclk' should not have a media clock identifier ('id='), which RFC 7273 Section 5.4 allows but receivers might not support.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 8.1 Test 3 - Attribute \'mediaclk\' has no media clock identifier.');
  }
  return errors;
};

// ST 2110-10 Section 8.2 Test 1 - Every stream has a media-level 'ts-refclk' attribute
const test_10_82_1 = (sdp, params) => {
  let errors = [];
  let streams = sdp.split(/[\r\n]m=/).slice(1);
  let mediaLines = splitLines(sdp).flatMap((line, x) => line.startsWith('m=') ? [x + 1] : []);
  for (let s = 0; s < streams.length; s++) {
    if (!tsrefclkPattern.test(streams[s])) {
      errors.push(new LineError(mediaLines[s], `For stream ${s + 1}, the media description shall have a 'ts-refclk' attribute, as per ST 2110-10 Section 8.2.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 8.2 Test 1 - Every stream has a media-level \'ts-refclk\' attribute.');
  }
  return errors;
};

// ST 2110-10 Section 8.2 Test 2 is now ST 2110-10:2022 Section 8.2 Test 1

// ST 2110-10:2022 Section 8.2 Test 1 - Reference clocks are a form specified in RFC 7273 or the 'localmac' form
// ST 2110-10:2022 Section 8.2 allows any form specified in RFC 7273
const test_10_2022_82_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let mediaLevel = false;
  for (let x = 0; x < lines.length; x++) {
    if (!mediaLevel) {
      if (lines[x].startsWith('m=')) {
        mediaLevel = true;
      }
      continue;
    }
    // A 'ts-refclk' that is not an acceptable pattern is reported by RFC 4566 Section 6 Test 2
    if (lines[x].startsWith('a=ts-refclk') && isAcceptableAttribute(lines[x])) {
      if (!lines[x].startsWith('a=ts-refclk:ptp=') &&
        !lines[x].startsWith('a=ts-refclk:localmac') &&
        !otherRefclkPattern.test(lines[x])) {
        errors.push(
          new LineError(x + 1, 'Attribute \'ts-refclk\' is not an acceptable pattern, which shall be a form specified in RFC 7273 Section 4.8 or the \'localmac\' form, as per ST 2110-10:2022 Section 8.2.'));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10:2022 Section 8.2 Test 1 - Reference clocks are a form specified in RFC 7273 or the \'localmac\' form.');
  }
  return errors;
};

// ST 2110-10 Section 8.2 Test 3 - PTP parameters of attribute 'ts-refclk' are acceptable values
const test_10_82_3 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let mediaLevel = false;
  for (let x = 0; x < lines.length; x++) {
    if (!mediaLevel) {
      if (lines[x].startsWith('m=')) {
        mediaLevel = true;
      }
      continue;
    }
    // A 'ts-refclk' that is not an acceptable pattern is reported by RFC 4566 Section 6 Test 2
    if (lines[x].startsWith('a=ts-refclk:ptp=') && isAcceptableAttribute(lines[x])) {
      let ptpDetails = lines[x].slice(16);
      let ptpVersion = ptpDetails.split(':')[0];
      if (!ptpVersions.includes(ptpVersion)) {
        errors.push(new LineError(x + 1, `Attribute 'ts-refclk' of type 'ptp' must specify PTP version 'IEEE1588-2002', 'IEEE1588-2008' or 'IEEE802.1AS-2011', but specifies '${ptpVersion}', as per RFC 7273 Section 4.8.`));
        continue;
      }
      if (params.should && ptpVersion !== 'IEEE1588-2008') {
        errors.push(new LineError(x + 1, 'Attribute \'ts-refclk\' of type \'ptp\' should specify \'IEEE1588-2008\', the version of the Common Reference Clock, as per ST 2110-10:2022 Sections 7.2 and 8.2.'));
      }
      let ptpMatch = ptpDetails.slice(ptpVersion.length + 1).match(ptpPattern);
      if (ptpMatch[2]) {
        // IEEE 1588-2002 identifies a PTP domain by a name, and IEEE 1588-2008 and IEEE 802.1AS-2011 by a number with no leading zeros,
        // as per RFC 7273 Section 4.8, and the domain of any other version is checked as a number too
        if (ptpVersion !== 'IEEE1588-2002' && !/^(?:\d|[1-9]\d|1[01]\d|12[0-7])$/.test(ptpMatch[2])) {
          errors.push(new LineError(x + 1, `Attribute 'ts-refclk' of type 'ptp' must specify a PTP domain number in the range 0 to 127 inclusive, but specifies '${ptpMatch[2]}', as per RFC 7273 Section 4.8.`));
        }
      } else if (ptpMatch[1] && ptpVersion === 'IEEE1588-2008') {
        // RFC 7273 permits ptp-domain to be omitted, but ST 2110-10 does not for IEEE 1588-2008
        errors.push(new LineError(x + 1, 'Attribute \'ts-refclk\' of type \'ptp\' shall specify a PTP domain number, as per ST 2110-10 Section 8.2.'));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 8.2 Test 3 - PTP parameters of attribute \'ts-refclk\' are acceptable values.');
  }
  return errors;
};

// ST 2110-10 Section 8.2 Test 4 - A 'localmac' reference clock has a valid MAC address
const test_10_82_4 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let mediaLevel = false;
  for (let x = 0; x < lines.length; x++) {
    if (!mediaLevel) {
      if (lines[x].startsWith('m=')) {
        mediaLevel = true;
      }
      continue;
    }
    // A 'ts-refclk' that is not an acceptable pattern is reported by RFC 4566 Section 6 Test 2
    if (lines[x].startsWith('a=ts-refclk:localmac=') && isAcceptableAttribute(lines[x])) {
      let mac = lines[x].slice(21);
      if (!macPattern.test(mac)) {
        errors.push(new LineError(x + 1, 'Attribute \'ts-refclk\' of type \'localmac\' shall specify a MAC address of the form \'XX-XX-XX-XX-XX-XX\', as per ST 2110-10 Section 8.2.'));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 8.2 Test 4 - A \'localmac\' reference clock has a valid MAC address.');
  }
  return errors;
};

// ST 2110-10 Section 8.3 Test 1 - Duplicate streams are signalled
// [also ST 2110-10:2022 Section 8.5]
const test_10_83_1 = (sdp, params) => {
  if (!params.duplicate) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5] Test 1 - Duplicate streams are signalled. Use --duplicate to test.');
    }
    return [];
  }
  if (dupPattern.test(sdp)) {
    if (params.verbose) {
      console.log('Test Passed: ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5] Test 1 - Duplicate streams are signalled.');
    }
    return [];
  } else {
    // Report the first media description, which a session-level attribute must come before
    const lines = splitLines(sdp);
    const line = lines.findIndex(line => line.startsWith('m=')) + 1 || lines.length;
    return [new LineError(line, 'Duplicate RTP streams, as requested by --duplicate, shall be signalled with a session-level \'group:DUP\' attribute, as per ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5].')];
  }
};

// ST 2110-10 Section 8.3 Test 2 - Duplicate streams with separate source addresses are grouped, as per RFC 7104 Section 4.1
// [also ST 2110-10:2022 Section 8.5]
const test_10_83_2 = (sdp, params) => {
  if (!sdp.match(/a=ssrc-group/)) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5] Test 2 - Duplicate streams with separate source addresses are grouped, as per RFC 7104 Section 4.1. No \'a=ssrc-group\' attribute is present.');
    }
    return [];
  }
  let lines = splitLines(sdp);
  let errors = [];
  let ssrcs = [[]];
  let streamCounter = 0;
  for (let x = 0; x < lines.length; x++) { // Order of ssrc and ssrc-group nor defined ...
    if (lines[x].startsWith('m=')) {
      streamCounter++;
      ssrcs.push([]);
    }
    if (lines[x].startsWith('a=ssrc:')) {
      let ssrcMatch = lines[x].match(ssrcPattern);
      // An 'ssrc' that is not an acceptable pattern is reported by RFC 4566 Section 6 Test 2,
      // so one that starts with an SSRC identifier counts as defining it, and that SSRC is not reported again as undefined
      if (!ssrcMatch) {
        continue;
      }
      ssrcs[streamCounter].push(+ssrcMatch[1]);
    }
  }
  streamCounter = 0;
  for (let x = 0; x < lines.length; x++) { // .. so iterate twice
    if (lines[x].startsWith('m=')) {
      streamCounter++;
    }
    if (!/^a=ssrc-group:DUP(?:\s|$)/.test(lines[x]) || (streamCounter === 0)) {
      continue;
    }
    let groupMatch = lines[x].match(ssrcGroupPattern);
    if (!groupMatch) {
      // An 'ssrc-group' that is not an acceptable pattern for any semantics is reported by RFC 4566 Section 6 Test 2
      if (isAcceptableAttribute(lines[x])) {
        errors.push(new LineError(x + 1, `For stream ${streamCounter}, attribute 'ssrc-group:DUP' is not an acceptable pattern, as per RFC 7104 Section 3.2.`));
      }
      continue;
    }
    for (let groupID of groupMatch.slice(1, 3)) {
      if (ssrcs[streamCounter].indexOf(+groupID) < 0) {
        errors.push(new LineError(x + 1, `For stream ${streamCounter}, SSRC '${groupID}' in attribute 'ssrc-group' must be defined by an 'ssrc' attribute, as per RFC 5576 Section 4.2.`));
      }
    }
  }
  // TODO check the source-filter lines have one Mcast address and 2 IP addresses
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5] Test 2 - Duplicate streams with separate source addresses are grouped, as per RFC 7104 Section 4.1.');
  }
  return errors;
};

// ST 2110-10 Section 8.3 Test 3 - Duplicate streams with separate destination addresses are grouped, as per RFC 7104 Section 4.2
// [also ST 2110-10:2022 Section 8.5]
const test_10_83_3 = (sdp, params) => {
  if (!sdp.match(/a=group/)) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5] Test 3 - Duplicate streams with separate destination addresses are grouped, as per RFC 7104 Section 4.2. No \'a=group\' attribute is present.');
    }
    return [];
  }
  let lines = splitLines(sdp);
  let errors = [];
  let mids = [];
  let malformedMid = false;
  let streamCounter = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      if (!mids[streamCounter++]) { mids.push(''); }
    }
    if (lines[x].startsWith('a=mid:')) {
      // A 'mid' that is not an acceptable pattern is reported by RFC 4566 Section 6 Test 2,
      // so an identification tag that matches no 'mid' is not reported again
      if (!isAcceptableAttribute(lines[x])) {
        malformedMid = true;
        continue;
      }
      let mid = lines[x].slice(6);
      if (mids.indexOf(mid) >= 0) {
        errors.push(new LineError(x + 1, `Media identification '${mid}' must be unique, as per RFC 5888 Section 4.`));
        continue;
      }
      if (mids[streamCounter]) {
        errors.push(new LineError(x + 1, `For stream ${streamCounter}, a media description must have at most one 'mid' attribute, but has '${mids[streamCounter]}' and '${mid}', as per RFC 5888 Section 4.`));
        continue;
      }
      mids.push(mid);
    }
  }
  let doneOne = false;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      if (!doneOne) {
        errors.push(new LineError(x + 1, 'The session-level description must include attribute \'group:DUP\', as per RFC 7104 Section 3.1.'));
      }
      break;
    }
    if (!lines[x].startsWith('a=group')) {
      continue;
    }
    let groupMatch = lines[x].match(groupPattern);
    if (!groupMatch) {
      // A 'group' that is not an acceptable pattern for any semantics is reported by RFC 4566 Section 6 Test 2,
      // so it counts as present
      if (isAcceptableAttribute(lines[x])) {
        errors.push(new LineError(x + 1, 'Attribute \'group:DUP\' is not an acceptable pattern, as per RFC 7104 Section 3.1.'));
      } else {
        doneOne = true;
      }
      continue;
    }
    doneOne = true;
    for (let groupId of groupMatch.slice(1, 3)) {
      if (mids.indexOf(groupId) < 0 && !malformedMid) {
        errors.push(new LineError(x + 1, `Identification tag '${groupId}' in attribute 'group:DUP' must match the 'mid' attribute of a media description, otherwise the group is ignored, as per RFC 5888 Section 6.`));
      }
    }
  }
  // TODO check the source-filter lines have one Mcast address and 2 IP addresses
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5] Test 3 - Duplicate streams with separate destination addresses are grouped, as per RFC 7104 Section 4.2.');
  }
  return errors;
};

// SMPTE RP 2110-23 Section 5.3 Test 1 - Each media description ends with its 'a=mid' attribute
const test_23_53_1 = (sdp, params) => {
  if (!params.midLast) {
    if (params.verbose) {
      console.log('Test Skipped: SMPTE RP 2110-23 Section 5.3 Test 1 - Each media description ends with its \'a=mid\' attribute. Use --midLast to test.');
    }
    return [];
  }
  if (!sdp.match(/a=mid:/)) {
    if (params.verbose) {
      console.log('Test Skipped: SMPTE RP 2110-23 Section 5.3 Test 1 - Each media description ends with its \'a=mid\' attribute. No \'a=mid\' present.');
    }
    return [];
  }
  let lines = splitLines(sdp);
  let errors = [];
  let streamCounter = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x] === '') {
      continue;
    }
    if (lines[x].startsWith('m=')) {
      streamCounter++;
    }
    let next = lines.slice(x + 1).find(line => line !== '');
    let isLastLineOfMediaDescription = next === undefined || next.startsWith('m=');
    if (streamCounter > 0 && isLastLineOfMediaDescription && !lines[x].startsWith('a=mid:')) {
      errors.push(new LineError(x + 1, `For stream ${streamCounter}, the media description does not end with its 'a=mid' attribute. RFC 8866 does not require this, but receivers that follow SMPTE RP 2110-23 Section 5.3 may expect it.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: SMPTE RP 2110-23 Section 5.3 Test 1 - Each media description ends with its \'a=mid\' attribute.');
  }
  return errors;
};

// ST 2110-10 Section 8.4 Test 1 - Format parameter 'MAXUDP' has an acceptable value
// [also ST 2110-10:2022 Section 8.6]
const test_10_84_1 = (sdp, params) => {
  const [mtParams, errors] = extractMTParams(sdp, params);
  for (const stream of mtParams) {
    if ('MAXUDP' in stream) {
      const MAXUDP = +stream.MAXUDP;
      if (isNaN(MAXUDP) || integerPattern.test(stream.MAXUDP) === false) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'MAXUDP' shall be a decimal value, as per ST 2110-10 Section 8.4 [also ST 2110-10:2022 Section 8.6].`));
      } else if (MAXUDP > 8960) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'MAXUDP' shall not exceed the Extended UDP Size Limit of 8960 octets, but is '${MAXUDP}', as per ST 2110-10 Sections 6.4 and 8.4 [also ST 2110-10:2022 Sections 6.4 and 8.6].`));
      } else if (MAXUDP < 20) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'MAXUDP' is '${MAXUDP}', which is less than the 20 octets of the UDP and RTP headers, so SDPoker does not accept it.`));
      }
    }
  }
  if (params.verbose && errors.length === 0) {
    console.log('Test Passed: ST 2110-10 Section 8.4 [also ST 2110-10:2022 Section 8.6] Test 1 - Format parameter \'MAXUDP\' has an acceptable value.');
  }
  return errors;
};

// ST 2110-10 Section 6.2 Test 1 - Media descriptions have an acceptable pattern, port, protocol and payload type
const test_10_62_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  for (let x = 0; x < lines.length; x++) {
    if (!lines[x].startsWith('m=')) {
      continue;
    }
    streamCount++;

    let mediaMatch = lines[x].match(mediaPattern);
    if (!mediaMatch) {
      errors.push(new LineError(x + 1, 'Media field (\'m=\') is not an acceptable pattern, which shall be of the form \'m=<media> <port> RTP/AVP <payload type>\', as per ST 2110-10 Section 6.2 and RFC 4566 Section 5.14.'));
      continue;
    }
    // Check port number - ST 2110-10 Section 6.2 says shall be UDP, so assume 0-65535
    let port = +mediaMatch[2];
    if (isNaN(port) || port < 0 || port > 65535) {
      errors.push(new LineError(x + 1, `For stream ${streamCount}, port '${port}' shall be a UDP port in the range 0 to 65535 inclusive, as per ST 2110-10 Section 6.2.`));
    }
    // Check RTP type - ST 2110-10 Section 6.2 says shall be RTP, no allowance for SRTP
    if (mediaMatch[4] === 'RTP/SAVP') {
      errors.push(new LineError(x + 1, `For stream ${streamCount}, the transport protocol shall be 'RTP/AVP', as per ST 2110-10 Section 6.2.`));
    }
    // Check dynamic range - assume ST 2110-20 is always dynamic
    let payloadType = +mediaMatch[5];
    if (isNaN(payloadType) || payloadType < 96 || payloadType > 127) {
      errors.push(new LineError(x + 1, `For stream ${streamCount}, payload type '${mediaMatch[5]}' shall be a dynamic payload type in the range 96 to 127 inclusive, as per ST 2110-10 Section 6.2.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 6.2 Test 1 - Media descriptions have an acceptable pattern, port, protocol and payload type.');
  }
  return errors;
};

// ST 2110-10 Section 6.2 Test 2 - Payload types of 'rtpmap' and 'fmtp' attributes are formats of the media description, and each dynamic payload type has an 'rtpmap' attribute
/* ST 2110-10 Section 6.2 says:
All RTP streams shall use dynamic payload types chosen in the range of 96 through 127, signaled as specified in section 6 of IETF RFC 4566 ...
RFC 4566 Section 6 says of 'rtpmap':
Up to one rtpmap attribute can be defined for each media format specified.
and of 'fmtp':
The format must be one of the formats specified for the media.
*/
const test_10_62_2 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streams = [];
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      let mediaMatch = lines[x].match(mediaPattern);
      streams.push({
        line: x + 1,
        payloadTypes: mediaMatch ? lines[x].trim().split(/\s+/).slice(3).map(Number) : [],
        rtpmaps: []
      });
      continue;
    }
    let attributeMatch = lines[x].match(/^a=(rtpmap|fmtp):(\d+)/);
    if (!attributeMatch || streams.length == 0) {
      continue;
    }
    let stream = streams[streams.length - 1];
    let payloadType = +attributeMatch[2];
    if (!stream.payloadTypes.includes(payloadType)) {
      errors.push(new LineError(x + 1, `For stream ${streams.length}, payload type '${payloadType}' of attribute '${attributeMatch[1]}' must be a format of the media description, as per RFC 4566 Section 6.`));
    } else if (attributeMatch[1] === 'rtpmap') {
      stream.rtpmaps.push(payloadType);
    }
  }
  streams.forEach((stream, s) => {
    for (let payloadType of stream.payloadTypes) {
      if (payloadType >= 96 && payloadType <= 127 && !stream.rtpmaps.includes(payloadType)) {
        errors.push(new LineError(stream.line, `For stream ${s + 1}, dynamic payload type '${payloadType}' shall have an 'rtpmap' attribute, as per ST 2110-10 Section 6.2.`));
      }
    }
  });
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10 Section 6.2 Test 2 - Payload types of \'rtpmap\' and \'fmtp\' attributes are formats of the media description, and each dynamic payload type has an \'rtpmap\' attribute.');
  }
  return errors;
};

// ST 2110-10 Section 6.2 Test 3 is now RFC 4566 Section 6 Test 2

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

// Find the streams with a multicast destination address that no inclusive 'source-filter' attribute covers.
// A media-level source filter completely overrides a session-level source filter, as per RFC 4570 Section 3.
const streamsWithoutSourceFilter = sdp => {
  let lines = splitLines(sdp);
  let session = { filters: [] };
  let streams = [];
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      streams.push({ line: x + 1, address: session.address, filters: [] });
      continue;
    }
    let scope = streams.length > 0 ? streams[streams.length - 1] : session;
    if (lines[x].startsWith('c=')) {
      let cMatch = lines[x].match(cPattern);
      if (cMatch) {
        scope.address = cMatch[2];
      }
    } else if (lines[x].startsWith('a=source-filter:')) {
      let sourceFilterMatch = lines[x].match(sourceFilterPattern);
      if (sourceFilterMatch) {
        scope.filters.push({ mode: sourceFilterMatch[1], address: sourceFilterMatch[3] });
      }
    }
  }
  return streams
    .map((stream, s) => ({ ...stream, streamNumber: s + 1 }))
    .filter(stream => {
      if (!stream.address || !multiPattern.test(stream.address)) {
        return false;
      }
      let filters = stream.filters.length > 0 ? stream.filters : session.filters;
      return !filters.some(filter => filter.mode === 'incl' &&
        (canonicalAddress(filter.address) === canonicalAddress(stream.address) || filter.address === '*'));
    });
};

// ST 2110-10:2022 Section 8.3 Test 1 - Attribute 'mediaclk' uses the direct or sender reference
const test_10_2022_83_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      streamCount++;
      continue;
    }
    let typeMatch = lines[x].match(mediaclkTypePattern);
    if (typeMatch && typeMatch[1] !== 'direct' && typeMatch[1] !== 'sender') {
      errors.push(new LineError(x + 1, `For ${streamCount ? 'stream ' + streamCount : 'all streams'}, attribute 'mediaclk' shall use the 'direct' or 'sender' reference, not '${typeMatch[1]}', as per ST 2110-10:2022 Section 8.3.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10:2022 Section 8.3 Test 1 - Attribute \'mediaclk\' uses the direct or sender reference.');
  }
  return errors;
};

// ST 2110-10:2022 Section 8.4 Test 1 - Streams with a source-specific multicast destination address have an inclusive source filter
/* ST 2110-10:2022 Section 8.4 says:
Senders should indicate the source address information for streams within the SDP in order to support source-specific multicast sessions by use of an inclusive source filter line as defined in IETF RFC 4570
This is a requirement for source-specific multicast destination addresses because routers do not forward a stream in that range
to a Receiver that does not specify the source, as per RFC 4607 Section 5.2.
*/
const test_10_2022_84_1 = (sdp, params) => {
  let errors = streamsWithoutSourceFilter(sdp)
    .filter(stream => ssmPattern.test(stream.address))
    .map(stream => new LineError(stream.line, `For stream ${stream.streamNumber}, destination address '${stream.address}' is in the source-specific multicast range, so an inclusive 'source-filter' attribute must be included for Receivers to join the stream, as per RFC 4607 Sections 1 and 5.2 and ST 2110-10:2022 Section 8.4.`));
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10:2022 Section 8.4 Test 1 - Streams with a source-specific multicast destination address have an inclusive source filter.');
  }
  return errors;
};

// ST 2110-10:2022 Section 8.4 Test 2 - Streams with another multicast destination address have an inclusive source filter
const test_10_2022_84_2 = (sdp, params) => {
  if (!params.should) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-10:2022 Section 8.4 Test 2 - Streams with another multicast destination address have an inclusive source filter. Use --should to test.');
    }
    return [];
  }
  let errors = streamsWithoutSourceFilter(sdp)
    .filter(stream => !ssmPattern.test(stream.address))
    .map(stream => new LineError(stream.line, `For stream ${stream.streamNumber}, destination address '${stream.address}' is multicast, so an inclusive 'source-filter' attribute should be included to support source-specific multicast, as per ST 2110-10:2022 Section 8.4.`));
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10:2022 Section 8.4 Test 2 - Streams with another multicast destination address have an inclusive source filter.');
  }
  return errors;
};

const tsmodePermitted2022 = ['SAMP', 'NEW', 'PRES'];

// ST 2110-10:2022 Section 8.7 Test 1 - Format parameters 'TSMODE' and 'TSDELAY' are acceptable values
const test_10_2022_87_1 = (sdp, params) => {
  // This test runs for every stream format, so it also reports any repeated format parameter
  let [mtParams, dupErrors] = extractMTParams(sdp, { checkDups: true });
  let errors = [];
  for (let stream of mtParams) {
    let keys = Object.keys(stream);
    if (keys.indexOf('TSMODE') >= 0) {
      if (tsmodePermitted2022.indexOf(stream.TSMODE) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TSMODE' shall be 'SAMP', 'NEW' or 'PRES', as per ST 2110-10:2022 Section 8.7.`));
      }
    }
    if (keys.indexOf('TSDELAY') >= 0) {
      // ST 2110-10:2022 Section 8.7 says a positive integer, but its Annex B example uses 'TSDELAY=0'
      if (!/^\d+$/.test(stream.TSDELAY)) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TSDELAY' shall be an integer number of microseconds, as per ST 2110-10:2022 Section 8.7.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-10:2022 Section 8.7 Test 1 - Format parameters \'TSMODE\' and \'TSDELAY\' are acceptable values.');
  }
  return dupErrors.concat(errors);
};

// Function to check that rtpmap has passed in type and clockRate.
// An optional specification string can be used to be included in errors
// produced as a reference back to a spec
const checkStreamsRtpMap = (sdp, params, type, clockRate, specification) => {
  let errors = [];
  let lines = splitLines(sdp);
  let rtpmapInStream = true;
  let payloadType = -1;
  let streamCount = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      let videoMatch = lines[x].match(videoPattern);
      payloadType = videoMatch ? +videoMatch[4] : -1;
      rtpmapInStream = false;
      streamCount++;
      continue;
    }
    if (lines[x].startsWith('a=rtpmap') && payloadType >= 0) {
      if (rtpmapInStream) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, attribute 'rtpmap' is specified more than once.`));
        continue;
      }
      rtpmapInStream = true;
      let rtpmapMatch = lines[x].match(rtpmapPattern);
      // An 'rtpmap' that is not an acceptable pattern is reported by RFC 4566 Section 6 Test 2
      if (!rtpmapMatch) {
        continue;
      }
      if (+rtpmapMatch[1] !== payloadType) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, payload type '${rtpmapMatch[1]}' of attribute 'rtpmap' must be the payload type '${payloadType}' of the media description, as per RFC 4566 Section 6.`));
      }
      if (skipVideoTypes.includes(rtpmapMatch[2])) {
        continue;
      } else if (rtpmapMatch[2] !== type) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, encoding name shall be media sub-type '${type}', as per ${specification}.`));
      }
      if (rtpmapMatch[3] !== clockRate) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, clock rate shall be '${clockRate}', as per ${specification}.`));
      }
    }
  }
  return errors;
};

// ST 2110-20 Section 7.1 Test 1 checked all streams are video, as requested by the removed --videoOnly option
// ST 2110-20 Section 7.1 Test 2 is now ST 2110-10 Section 6.2 Test 1
// ST 2110-20 Section 7.1 Test 3 - All video streams have an 'rtpmap' attribute with 'raw/90000'
const test_20_71_3 = (sdp, params) => {
  let errors = checkStreamsRtpMap(sdp, params, 'raw', '90000', 'ST 2110-20 Section 7.1');
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.1 Test 3 - All video streams have an \'rtpmap\' attribute with \'raw/90000\'.');
  }
  return errors;
};

// Function to check that each stream has one 'fmtp' attribute for its payload type,
// for a format that has required format parameters.
// The specification string is included in errors as a reference back to a spec
const checkStreamsFmtp = (sdp, specification) => {
  let errors = [];
  let lines = splitLines(sdp);
  let fmtpInStream = true;
  let payloadType = -1;
  let streamCount = 0;
  let mediaLine = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      if (!fmtpInStream && payloadType >= 0) {
        errors.push(new LineError(mediaLine, `For stream ${streamCount}, an 'fmtp' attribute shall be specified, as per ${specification}.`));
      }
      let mediaMatch = lines[x].match(mediaPattern);
      payloadType = mediaMatch ? +mediaMatch[5] : -1;
      fmtpInStream = false;
      streamCount++;
      mediaLine = x + 1;
      continue;
    }
    if (lines[x].startsWith('a=fmtp') && payloadType >= 0) {
      if (fmtpInStream) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, attribute 'fmtp' is specified more than once.`));
        continue;
      }
      fmtpInStream = true;
      let fmtpMatch = lines[x].match(fmtpPattern);
      // An 'fmtp' that is not an acceptable pattern is reported by extractMTParams
      if (!fmtpMatch) {
        continue;
      }
      if (+fmtpMatch[1] !== payloadType) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, payload type '${fmtpMatch[1]}' of attribute 'fmtp' must be the payload type '${payloadType}' of the media description, as per RFC 4566 Section 6.`));
      }
    }
  }
  if (!fmtpInStream && payloadType >= 0) {
    errors.push(new LineError(mediaLine, `For stream ${streamCount}, an 'fmtp' attribute shall be specified, as per ${specification}.`));
  }
  return errors;
};

// ST 2110-20 Section 7.1 Test 4 - Every stream has format parameters
const test_20_71_4 = (sdp, params) => {
  let errors = checkStreamsFmtp(sdp, 'ST 2110-20 Section 7.1');
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.1 Test 4 - Every stream has format parameters.');
  }
  return errors;
};

// The encoding name of the first format of a stream, which is its default format, as per RFC 4566 Section 5.14,
// and which the tests of its essence are chosen from
const encodingNameOf = stream => stream.encodingNames[stream.formats[0]];

// The format parameters of each 'fmtp' attribute, with the stream and format it belongs to, for each stream whose
// media field is an acceptable pattern
// Test for duplicate parameters by setting params.checkDups
/** @returns {[object[], Error[]]} */
const extractMTParams = (sdp, params = {}) => {
  let mtParams = [];
  let errors = [];
  let lines = splitLines(sdp);
  let lastStream;
  for (let stream of extractStreams(sdp)) {
    if (!mediaPattern.test(lines[stream.line - 1])) {
      errors.push(new LineError(stream.line, 'Media field (\'m=\') is not an acceptable pattern, which shall be of the form \'m=<media> <port> RTP/AVP <payload type>\', as per ST 2110-10 Section 6.2 and RFC 4566 Section 5.14.'));
      continue;
    }
    lastStream = stream;
    for (let fmtp of stream.fmtp) {
      if (!fmtp.params) {
        // An 'fmtp' that is not an acceptable pattern for any format is reported by RFC 4566 Section 6 Test 2
        if (isAcceptableAttribute(lines[fmtp.line - 1])) {
          errors.push(new LineError(fmtp.line, `For stream ${stream.streamNumber}, attribute 'fmtp' must be a list of format specific parameters separated by semicolons, each a name or a name=value pair with no whitespace, as per RFC 8866 Section 6.15 and RFC 4855 Section 3.`));
        }
        continue;
      }
      // A payload type that is not a format of the media description is reported by test_10_62_2
      let encodingName = stream.encodingNames[fmtp.format] ?? -1;
      if (!stream.formats.includes(fmtp.format) || skipVideoTypes.includes(encodingName)) {
        continue;
      }
      if (params.checkDups) {
        let keys = fmtp.names;
        let reported = [];
        for (let y = 0; y < keys.length; y++) {
          if (!repeatableParams.includes(keys[y]) && keys.filter(k => keys[y] === k).length >= 2) {
            if (reported.indexOf(keys[y]) < 0) {
              errors.push(new LineError(fmtp.line, `For stream ${stream.streamNumber}, format parameter '${keys[y]}' is specified more than once.`));
              reported.push(keys[y]);
            }
          }
        }
      }
      mtParams.push({
        ...fmtp.params,
        _payloadType: +fmtp.format,
        _line: fmtp.line,
        _streamNumber: stream.streamNumber,
        _mediaType: stream.mediaType,
        _encodingName: encodingName
      });
    }
  }
  // If no fmtp parameters still load up the other valid items (audio files for example)
  if (mtParams.length == 0) {
    let paramsObject = [];
    if (lastStream) {
      paramsObject._payloadType = +lastStream.formats[0];
      paramsObject._line = lastStream.line;
      paramsObject._streamNumber = lastStream.streamNumber;
      paramsObject._mediaType = lastStream.mediaType;
      paramsObject._encodingName = encodingNameOf(lastStream) ?? -1;
    } else {
      paramsObject._payloadType = -1;
      paramsObject._line = lines.length;
      paramsObject._streamNumber = 0;
      paramsObject._mediaType = -1;
      paramsObject._encodingName = -1;
    }
    mtParams.push(paramsObject);
  }
  return [mtParams, errors];
};

const mustHaves20 = ['sampling', 'depth', 'width', 'height', 'exactframerate',
  'colorimetry', 'PM', 'SSN'];

// ST 2110-20 Section 7.2 Test 1 - All required format parameters are present
const test_20_72_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (stream._encodingName == 'raw') {
      let keys = Object.keys(stream);
      for (let param of mustHaves20) {
        if (keys.indexOf(param) < 0) {
          errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter '${param}' shall be specified, as per ST 2110-20 Section 7.2.`));
        }
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.2 Test 1 - All required format parameters are present.');
  }
  return errors;
};

// ST 2110-20 Section 7.2 Test 2 - Format parameters 'width' and 'height' are within bounds
const test_20_72_2 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.width !== 'undefined' && typeof stream.height !== 'undefined') { // Test 1 confirms
      let width = +stream.width;
      if (isNaN(width) || integerPattern.test(stream.width) === false) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'width' shall be an integer value, as per ST 2110-20 Section 7.2.`));
      } else if (width < 1 || width > 32767) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'width' shall be in the range 1 to 32767 inclusive, but is '${width}', as per ST 2110-20 Section 7.2.`));
      }
      let height = +stream.height;
      if (isNaN(height) || integerPattern.test(stream.height) === false) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'height' shall be an integer value, as per ST 2110-20 Section 7.2.`));
      } else if (height < 1 || height > 32767) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'height' shall be in the range 1 to 32767 inclusive, but is '${height}', as per ST 2110-20 Section 7.2.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.2 Test 2 - Format parameters \'width\' and \'height\' are within bounds.');
  }
  return errors;
};

const greatestCommonDivisor = (a, b) => !b ? a : greatestCommonDivisor(b, a % b);


/* 
Function to check ST 2110-20 Section 7.2
Checks for integer numerator/denominator when required
Checks if frame rate expressed as a ratio of integers is in lowest common denominator form.

**_exactframerate Signals the frame rate in frames per second. Integer frame rates shall be signaled as a single decimal number (e.g. “25”) whilst non-integer frame rates shall be signaled as a ratio of two integer decimal numbers separated by a “forward-slash”_**

*/
const checkExactframerate = (stream = {}, specification = 'ST 2110-20 Section 7.2') => {
  let errors = [];
  let frMatch = stream.exactframerate.match(frameRatePattern);
  if (!frMatch) {
    errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'exactframerate' is not an acceptable pattern, which shall be of the form '<integer>' or '<integer>/<integer>', as per ${specification}.`));
    return errors;
  }
  if (!frMatch[2]) { // Non-integer value tests
    return errors;
  }
  let numerator = +frMatch[1];
  let denominator = +frMatch[2];
  if (Number.isInteger(numerator / denominator)) {
    errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'exactframerate' shall be a single integer for an integer frame rate, as per ${specification}.`));
  }
  if (denominator > numerator) {
    errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'exactframerate' specifies a frame rate slower than one frame per second, which suggests that the numerator and denominator are swapped.`));
  }
  if (greatestCommonDivisor(numerator, denominator) !== 1) {
    errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'exactframerate' shall be a ratio in lowest terms, as per ${specification}.`));
  }
  return errors;
};

// ST 2110-20 Section 7.2 Test 3 - Format parameter 'exactframerate' is as specified
const test_20_72_3 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.exactframerate !== 'undefined') {
      errors = errors.concat(checkExactframerate(stream));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.2 Test 3 - Format parameter \'exactframerate\' is as specified.');
  }
  return errors;
};

const packingModes = ['2110GPM', '2110BPM'];

// ST 2110-20 Section 7.2 Test 4 - Format parameter 'PM' is a defined value
const test_20_72_4 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.PM !== 'undefined') {
      if (packingModes.indexOf(stream.PM) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'PM' (packing mode) shall be '2110GPM' or '2110BPM', but is '${stream.PM}', as per ST 2110-20 Sections 7.2 and 6.3.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.2 Test 4 - Format parameter \'PM\' is a defined value.');
  }
  return errors;
};

const ssnPermitted20 = ['ST2110-20:2017', 'ST2110-20:2022'];

// ST 2110-20 Section 7.2 Test 5 - Format parameter 'SSN' is the required fixed value
// [also ST 2110-20:2022 Section 7.2]
const test_20_72_5 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.SSN !== 'undefined') {
      if (ssnPermitted20.indexOf(stream.SSN) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' shall be 'ST2110-20:2017' or 'ST2110-20:2022', as per ST 2110-20 Section 7.2 [also ST 2110-20:2022 Section 7.2].`));
      } else {
        let detect2022tcs = typeof stream.TCS !== 'undefined' && stream.TCS === 'ST2115LOGS3';
        let detect2022colorimetry = typeof stream.colorimetry !== 'undefined' && stream.colorimetry === 'ALPHA';

        if ((detect2022tcs || detect2022colorimetry) && stream.SSN === 'ST2110-20:2017') {
          errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' shall be 'ST2110-20:2022' when 'TCS' is 'ST2115LOGS3' or 'colorimetry' is 'ALPHA', as per ST 2110-20:2022 Section 7.2.`));
        }
        if (!(detect2022tcs || detect2022colorimetry) && stream.SSN !== 'ST2110-20:2017') {
          errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' shall be 'ST2110-20:2017' unless 'TCS' is 'ST2115LOGS3' or 'colorimetry' is 'ALPHA', as per ST 2110-20:2022 Section 7.2.`));
        }
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.2 [also ST 2110-20:2022 Section 7.2] Test 5 - Format parameter \'SSN\' is the required fixed value.');
  }
  return errors;
};

// Requirements are 'shall' in SMPTE standards and 'must' in RFCs
const shallOrMust = specification => specification.startsWith('RFC') ? 'must' : 'shall';

const checkInterlace = (stream, specification) => {
  let errors = [];
  if (typeof stream.interlace !== 'undefined') {
    if (stream.interlace !== '') {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'interlace' ${shallOrMust(specification)} have no value, as per ${specification}.`));
    }
  }
  return errors;
};

// ST 2110-20 Section 7.3 Test 1 - Format parameter 'interlace' is name only
const test_20_73_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkInterlace(stream, 'ST 2110-20 Section 7.3'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.3 Test 1 - Format parameter \'interlace\' is name only.');
  }
  return errors;
};

const checkSegmented = (stream, specification) => {
  let errors = [];
  if (typeof stream.segmented !== 'undefined') {
    if (stream.segmented !== '') {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'segmented' ${shallOrMust(specification)} have no value, as per ${specification}.`));
    }
    if (typeof stream.interlace === 'undefined') {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'interlace' ${shallOrMust(specification)} be specified when 'segmented' is specified, as per ${specification}.`));
    }
  }
  return errors;
};

// ST 2110-20 Section 7.3 Test 2 - Format parameter 'segmented' is name only and format parameter 'interlace' is also signalled
const test_20_73_2 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkSegmented(stream, 'ST 2110-20 Section 7.3'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.3 Test 2 - Format parameter \'segmented\' is name only and format parameter \'interlace\' is also signalled.');
  }
  return errors;
};

const rangePermitted = ['NARROW', 'FULLPROTECT', 'FULL'];

const checkRange = (stream, specification) => {
  let errors = [];
  if (typeof stream.RANGE !== 'undefined') {
    if (stream.colorimetry === 'BT2100') {
      if (stream.RANGE !== 'FULL' && stream.RANGE !== 'NARROW') {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'RANGE' ${shallOrMust(specification)} be 'FULL' or 'NARROW' when 'colorimetry' is 'BT2100', but is '${stream.RANGE}', as per ${specification}.`));
      }
      return errors;
    }
    if (rangePermitted.indexOf(stream.RANGE) < 0) {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'RANGE' ${shallOrMust(specification)} be 'FULL', 'FULLPROTECT' or 'NARROW', but is '${stream.RANGE}', as per ${specification}.`));
    }
  }
  return errors;
};

// ST 2110-20 Section 7.3 Test 3 - Format parameter 'RANGE' has acceptable values in colorimetry context
const test_20_73_3 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkRange(stream, 'ST 2110-20 Section 7.3'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.3 Test 3 - Format parameter \'RANGE\' has acceptable values in colorimetry context.');
  }
  return errors;
};

// ST 2110-20 Section 7.3 Test 4 - Format parameter 'PAR' is an acceptable value
const test_20_73_4 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.PAR !== 'undefined') {
      let parMatch = stream.PAR.match(parPattern);
      if (!parMatch) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'PAR' is not an acceptable pattern, which shall be of the form '<integer>:<integer>', as per ST 2110-20 Section 7.3.`));
        continue;
      }
      let [numerator, denominator] = [+parMatch[1], +parMatch[2]];
      if (greatestCommonDivisor(numerator, denominator) > 1) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'PAR' shall be a ratio in lowest terms, but is '${stream.PAR}', as per ST 2110-20 Section 7.3.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.3 Test 4 - Format parameter \'PAR\' is an acceptable value.');
  }
  return errors;
};

const samplingPermitted = [
  'YCbCr-4:4:4', 'YCbCr-4:2:2', 'YCbCr-4:2:0',
  'CLYCbCr-4:4:4', 'CLYCbCr-4:2:2', 'CLYCbCr-4:2:0',
  'ICtCp-4:4:4', 'ICtCp-4:2:2', 'ICtCp-4:2:0',
  'RGB', 'XYZ', 'KEY'
];

const checkSampling = (stream, permitted, specification) => {
  let errors = [];
  if (typeof stream.sampling !== 'undefined') {
    if (permitted.indexOf(stream.sampling) < 0) {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'sampling' ${shallOrMust(specification)} be a permitted value, but is '${stream.sampling}', as per ${specification}.`));
      return errors;
    }
    // TODO colorimetry-specific tests - if possible
  }
  return errors;
};

// ST 2110-20 Section 7.4 Test 1 - Format parameter 'sampling' is a defined value
const test_20_74_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkSampling(stream, samplingPermitted, 'ST 2110-20 Section 7.4.1'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.4 Test 1 - Format parameter \'sampling\' is a defined value.');
  }
  return errors;
};

const depthPermitted = ['8', '10', '12', '16', '16f'];

// ST 2110-20 Section 7.4 Test 2 - Format parameter 'depth' is a permitted value
const test_20_74_2 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.depth !== 'undefined') {
      if (depthPermitted.indexOf(stream.depth) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'depth' shall be '8', '10', '12', '16' or '16f', but is '${stream.depth}', as per ST 2110-20 Section 7.4.2.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.4 Test 2 - Format parameter \'depth\' is a permitted value.');
  }
  return errors;
};

const colorPermitted20_2017 = [
  'BT601', 'BT709', 'BT2020', 'BT2100', 'ST2065-1',
  'ST2065-3', 'UNSPECIFIED', 'XYZ'];

const colorPermitted20_2022 = ['ALPHA'];

const checkColorimetry = (stream, permitted, specification) => {
  let errors = [];
  if (typeof stream.colorimetry !== 'undefined') {
    if (permitted.indexOf(stream.colorimetry) < 0) {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'colorimetry' ${shallOrMust(specification)} be a permitted value, but is '${stream.colorimetry}', as per ${specification}.`));
    }
  }
  return errors;
};

// ST 2110-20 Section 7.5 Test 1 - Format parameter 'colorimetry' is a permitted value
const test_20_75_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkColorimetry(stream, colorPermitted20_2017.concat(colorPermitted20_2022), 'ST 2110-20 Section 7.5'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.5 Test 1 - Format parameter \'colorimetry\' is a permitted value.');
  }
  return errors;
};

const checkRangeSpecified = (stream, specification) => {
  let errors = [];
  if (typeof stream.colorimetry !== 'undefined') {
    if (stream.colorimetry === 'BT2100' && typeof stream.RANGE === 'undefined') {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'RANGE' should be specified when 'colorimetry' is 'BT2100', as per ${specification}.`));
    }
  }
  return errors;
};

// ST 2110-20 Section 7.5 Test 2 - Signals using BT.2100 specify format parameter 'RANGE'
const test_20_75_2 = (sdp, params) => {
  if (!params.should) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-20 Section 7.5 Test 2 - Signals using BT.2100 specify format parameter \'RANGE\'. Use --should to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkRangeSpecified(stream, 'ST 2110-20 Section 7.5'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.5 Test 2 - Signals using BT.2100 specify format parameter \'RANGE\'.');
  }
  return errors;
};

const tcsPermitted20_2017 = [
  'SDR', 'PQ', 'HLG', 'LINEAR', 'BT2100LINPQ', 'BT2100LINHLG', 'ST2065-1',
  'ST428-1', 'DENSITY', 'UNSPECIFIED'
];

const tcsPermitted20_2022 = ['ST2115LOGS3'];

const checkTCS = (stream, permitted, specification) => {
  let errors = [];
  if (typeof stream.TCS !== 'undefined') {
    if (permitted.indexOf(stream.TCS) < 0) {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TCS' (Transfer Characteristic System) ${shallOrMust(specification)} be a permitted value, but is '${stream.TCS}', as per ${specification}.`));
    }
  }
  return errors;
};

// ST 2110-20 Section 7.6 Test 1 - Format parameter 'TCS' is a permitted value
const test_20_76_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkTCS(stream, tcsPermitted20_2017.concat(tcsPermitted20_2022), 'ST 2110-20 Section 7.6'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-20 Section 7.6 Test 1 - Format parameter \'TCS\' is a permitted value.');
  }
  return errors;
};

const sampleRatePermitted = ['44100', '48000', '96000'];

// The checkRtpmap function returns the messages for any further errors in an 'rtpmap' attribute that matches rtpmapPattern
const checkStreamsAudioRtpmap = (sdp, rtpmapPattern, patternMessage, sampleRateSpecification, checkRtpmap) => {
  let errors = [];
  let lines = splitLines(sdp);
  let payloadType = -1;
  let streamCount = 0;
  let hasRtpmap = true;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      let audioMatch = lines[x].match(audioPattern);
      payloadType = audioMatch ? +audioMatch[4] : -1;
      streamCount++;
      hasRtpmap = false;
      continue;
    }
    if (payloadType >= 0 && lines[x].startsWith('a=rtpmap')) {
      let soundMatch = lines[x].match(rtpmapPattern);
      if (!soundMatch) {
        // An 'rtpmap' that is not an acceptable pattern for any encoding is reported by RFC 4566 Section 6 Test 2
        if (isAcceptableAttribute(lines[x])) {
          errors.push(new LineError(x + 1, `For stream ${streamCount}, ${patternMessage}`));
        }
        continue;
      }
      if (hasRtpmap) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, attribute 'rtpmap' is specified more than once.`));
      }
      hasRtpmap = true;
      if (payloadType !== +soundMatch[1]) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, payload type '${soundMatch[1]}' of attribute 'rtpmap' must be the payload type '${payloadType}' of the media description, as per RFC 4566 Section 6.`));
      }
      if (sampleRatePermitted.indexOf(soundMatch[3]) < 0) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, the sampling rate in attribute 'rtpmap' shall be '44100', '48000' or '96000', but is '${soundMatch[3]}', as per ${sampleRateSpecification}.`));
      }
      for (let message of checkRtpmap(soundMatch)) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, ${message}`));
      }
    }
  }
  return errors;
};

// Note: Sample rate provisions of 6.1 are repeated by 6.2.1 reference to AES67 7.1

// ST 2110-30 Section 6.2.1 Test 1 - Audio 'rtpmap' attributes comply with AES67 Section 7.1
const test_30_62_1 = (sdp, params) => {
  let errors = checkStreamsAudioRtpmap(sdp, rtpmapSound,
    'attribute \'rtpmap\' is not an acceptable pattern, which shall be of the form \'a=rtpmap:<payload type> L16/<sampling rate>/<channels>\' or \'a=rtpmap:<payload type> L24/<sampling rate>/<channels>\', as per ST 2110-30 Section 6.2.1 and AES67 Section 7.1.',
    'ST 2110-30 Section 6.1 and AES67 Section 7.1',
    soundMatch => {
      let messages = [];
      switch (+soundMatch[3]) {
      case 48000:
        break; // L16 and L24 are supported
      case 96000:
        if (soundMatch[2] === 'L16') {
          messages.push('attribute \'rtpmap\' describes an out-of-scope combination of \'L16/96000\', as per ST 2110-30 Section 6.2.1 and AES67 Section 7.1.');
        }
        break;
      case 44100:
        if (soundMatch[2] === 'L24') {
          messages.push('attribute \'rtpmap\' describes an out-of-scope combination of \'L24/44100\', as per ST 2110-30 Section 6.2.1 and AES67 Section 7.1.');
        }
        break;
      default:
        break;
      }
      return messages;
    });
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-30 Section 6.2.1 Test 1 - Audio \'rtpmap\' attributes comply with AES67 Section 7.1.');
  }
  return errors;
};

const checkStreamsPtime = (sdp, ptimeSpecification) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  let hasPTime = true;
  let payloadType = -1;
  let mediaLine = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      if (!hasPTime && payloadType >= 0) {
        errors.push(new LineError(mediaLine, `For stream ${streamCount}, attribute 'ptime' shall be specified, as per ${ptimeSpecification}.`));
      }
      let audioMatch = lines[x].match(audioPattern);
      streamCount++;
      mediaLine = x + 1;
      payloadType = audioMatch ? +audioMatch[4] : -1;
      hasPTime = false;
      continue;
    }
    if (lines[x].startsWith('a=ptime') && payloadType >= 0) {
      if (hasPTime) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, attribute 'ptime' is specified more than once.`));
        continue;
      }
      hasPTime = true;
      // TODO check ptime by sample rate?
    }
  }
  if (!hasPTime && payloadType >= 0) {
    errors.push(new LineError(mediaLine, `For stream ${streamCount}, attribute 'ptime' shall be specified, as per ${ptimeSpecification}.`));
  }
  return errors;
};

// ST 2110-30 Section 6.2.1 Test 2 is now ST 2110-10 Section 6.2 Test 1
// ST 2110-30 Section 6.2.1 Test 3 - Attribute 'ptime' is present
// RFC 4566 Section 6 Test 2 checks that attributes 'ptime' and 'maxptime' match an acceptable pattern
const test_30_62_3 = (sdp, params) => {
  let errors = checkStreamsPtime(sdp, 'ST 2110-30 Section 6.2.1 and AES67 Section 8.1');
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-30 Section 6.2.1 Test 3 - Attribute \'ptime\' is present.');
  }
  return errors;
};

// The checkOrder function returns the messages for any errors in the value of format parameter 'channel-order'
const checkStreamsChannelOrder = (sdp, params, checkOrder) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  let hasFmtp = true;
  let payloadType = -1;
  let mediaLine = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      if (params.channelOrder === true && hasFmtp === false && payloadType >= 0) {
        errors.push(new LineError(mediaLine, `For stream ${streamCount}, format parameter 'channel-order' must be specified, as requested by --channelOrder.`));
      }
      let audioMatch = lines[x].match(audioPattern);
      payloadType = audioMatch ? +audioMatch[4] : -1;
      streamCount++;
      mediaLine = x + 1;
      hasFmtp = false;
      continue;
    }
    if (lines[x].startsWith('a=fmtp') && (payloadType >= 0)) {
      let fmtpMatch = lines[x].match(channelOrderPattern);
      if (fmtpMatch === null) {
        if (params.channelOrder === true) {
          errors.push(new LineError(x + 1, `For stream ${streamCount}, format parameter 'channel-order' must be specified, as requested by --channelOrder.`));
        }
        hasFmtp = true;
        continue;
      }
      if (hasFmtp) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, attribute 'fmtp' is specified more than once.`));
      }
      hasFmtp = true;
      if (payloadType !== +fmtpMatch[1]) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, payload type '${fmtpMatch[1]}' of attribute 'fmtp' must be the payload type '${payloadType}' of the media description, as per RFC 4566 Section 6.`));
      }
      for (let message of checkOrder(fmtpMatch[2])) {
        errors.push(new LineError(x + 1, `For stream ${streamCount}, ${message}`));
      }
    }
  }
  if (params.channelOrder === true && hasFmtp === false && payloadType >= 0) {
    errors.push(new LineError(mediaLine, `For stream ${streamCount}, format parameter 'channel-order' must be specified, as requested by --channelOrder.`));
  }
  return errors;
};

// ST 2110-30 Section 6.2.2 Tests 1 to 3 have never been assigned
// ST 2110-30 Section 6.2.2 Test 4 - Format parameter 'channel-order', if present, has an acceptable format
const test_30_62_4 = (sdp, params) => {
  let errors = checkStreamsChannelOrder(sdp, params, order => {
    let messages = [];
    if (params.should && !order.startsWith('SMPTE2110')) {
      messages.push(`format parameter 'channel-order' should be specified by the 'SMPTE2110' convention, not '${order.split('.')[0]}', as per ST 2110-30 Section 6.2.2.`);
    }
    if (order.startsWith('SMPTE2110') && !smpteChannelPattern.test(order)) {
      messages.push('format parameter \'channel-order\' is not an acceptable pattern, as per ST 2110-30 Section 6.2.2.');
    }
    return messages;
  });
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-30 Section 6.2.2 Test 4 - Format parameter \'channel-order\', if present, has an acceptable format.');
  }
  return errors;
};

// ST 2110-30 Section 6.2.2 Test 5 checked all streams are audio, as requested by the removed --audioOnly option

// Permitted packet times (ms) for each RTP clock rate, as per ST 2110-31 Section 6.1 Table 1
const ptimePermitted31 = {
  48000: [1, 0.12, 0.08],
  96000: [1, 0.12, 0.08],
  44100: [1.09, 0.14, 0.09]
};

// ST 2110-31 Section 6.1 Test 1 - Clock rate is permitted and number of AES3 subframe sequences is even
const test_31_61_1 = (sdp, params) => {
  let errors = checkStreamsAudioRtpmap(sdp, rtpmapAM824,
    'attribute \'rtpmap\' is not an acceptable pattern, which shall be of the form \'a=rtpmap:<payload type> AM824/<clock rate>/<channels>\', as per ST 2110-31 Section 6.1.',
    'ST 2110-31 Section 6.1',
    rtpmapMatch => +rtpmapMatch[4] % 2 !== 0 ?
      [`attribute 'rtpmap' shall specify an even number of AES3 subframe sequences, but specifies '${rtpmapMatch[4]}', as per ST 2110-31 Section 6.1.`] :
      []);
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-31 Section 6.1 Test 1 - Clock rate is permitted and number of AES3 subframe sequences is even.');
  }
  return errors;
};

// ST 2110-31 Section 6.1 Test 2 - Packet time is signalled
const test_31_61_2 = (sdp, params) => {
  let errors = checkStreamsPtime(sdp, 'ST 2110-31 Section 6.1');
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-31 Section 6.1 Test 2 - Packet time is signalled.');
  }
  return errors;
};

// ST 2110-31 Section 6.1 Test 3 - Packet time is permitted for the clock rate
const test_31_61_3 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streams = [];
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      streams.push({ ptimes: [] });
      continue;
    }
    if (streams.length === 0) {
      continue;
    }
    let stream = streams[streams.length - 1];
    let rtpmapMatch = lines[x].match(rtpmapAM824);
    if (rtpmapMatch) {
      stream.clockRate = rtpmapMatch[3];
    }
    let ptimeMatch = lines[x].match(ptimePattern);
    if (ptimeMatch) {
      stream.ptimes.push({ line: x + 1, ptime: ptimeMatch[1] });
    }
  }
  streams.forEach((stream, s) => {
    let permitted = ptimePermitted31[stream.clockRate];
    if (!permitted) {
      return;
    }
    for (let { line, ptime } of stream.ptimes) {
      if (!permitted.includes(+ptime)) {
        errors.push(new LineError(line, `For stream ${s + 1}, attribute 'ptime' shall be a packet time permitted for clock rate '${stream.clockRate}', but is '${ptime}', as per ST 2110-31 Section 6.1.`));
      }
    }
  });
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-31 Section 6.1 Test 3 - Packet time is permitted for the clock rate.');
  }
  return errors;
};

// ST 2110-31 Section 6.2 Test 1 - Format parameter 'channel-order', if present, has an acceptable format
const test_31_62_1 = (sdp, params) => {
  let errors = checkStreamsChannelOrder(sdp, params, order =>
    order.startsWith('SMPTE2110') && !smpteChannelPattern31.test(order) ?
      ['format parameter \'channel-order\' is not an acceptable pattern, as per ST 2110-31 Section 6.2.'] :
      []);
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-31 Section 6.2 Test 1 - Format parameter \'channel-order\', if present, has an acceptable format.');
  }
  return errors;
};

// ST 2110-21 Section 8.1 Test 1 - Format parameter 'TP' is specified
const test_21_81_1 = (sdp, params) => {
  if (params.shaping === false) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-21 Section 8.1 Test 1 - Format parameter \'TP\' is specified. Use --shaping to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.TP === 'undefined') {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TP' shall be specified, as per ST 2110-21 Section 8.1.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-21 Section 8.1 Test 1 - Format parameter \'TP\' is specified.');
  }
  return errors;
};

const typesPermitted = ['2110TPN', '2110TPNL', '2110TPW'];

// ST 2110-21 Section 8.1 Test 2 - Format parameter 'TP' is an acceptable value
const test_21_81_2 = (sdp, params) => {
  if (params.shaping === false) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-21 Section 8.1 Test 2 - Format parameter \'TP\' is an acceptable value. Use --shaping to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.TP !== 'undefined') {
      if (typesPermitted.indexOf(stream.TP) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TP' shall be '2110TPN', '2110TPNL' or '2110TPW', but is '${stream.TP}', as per ST 2110-21 Section 8.1.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-21 Section 8.1 Test 2 - Format parameter \'TP\' is an acceptable value.');
  }
  return errors;
};

/* When 'TROFF' (transmit offset) is present it shall be an integer number of microseconds, as per ST 2110-21 Section 8.2.
ST 2110-21 gives no sign constraint, but a negative offset is also reported.
*/
const checkTroff = (stream = {}, specification = 'ST 2110-21 Section 8.2') => {
  let errors = [];
  let troff = +stream.TROFF;
  if (isNaN(troff) || Number.isInteger(troff) === false) {
    errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TROFF' shall be an integer number of microseconds, but is '${stream.TROFF}', as per ${specification}.`));
  } else if (troff < 0) {
    errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TROFF' is '${stream.TROFF}', a negative transmit offset, which SDPoker does not accept.`));
  }
  return errors;
};

// ST 2110-21 Section 8.2 Test 1 - When format parameter 'TROFF' is specified, it is an acceptable value
const test_21_82_1 = (sdp, params) => {
  if (params.shaping === false) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-21 Section 8.2 Test 1 - When format parameter \'TROFF\' is specified, it is an acceptable value. Use --shaping to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.TROFF !== 'undefined') {
      errors = errors.concat(checkTroff(stream));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-21 Section 8.2 Test 1 - When format parameter \'TROFF\' is specified, it is an acceptable value.');
  }
  return errors;
};

// ST 2110-21 Section 8.2 Test 2 - When format parameter 'CMAX' is specified, it is an acceptable value
const test_21_82_2 = (sdp, params) => {
  if (params.shaping === false) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-21 Section 8.2 Test 2 - When format parameter \'CMAX\' is specified, it is an acceptable value. Use --shaping to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.CMAX !== 'undefined') {
      let cmax = +stream.CMAX;
      if (isNaN(cmax) || Number.isInteger(cmax) === false) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'CMAX' shall be an integer, but is '${stream.CMAX}', as per ST 2110-21 Section 8.2.`));
      } else if (cmax < 1) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'CMAX' is '${stream.CMAX}', which is less than 1, so SDPoker does not accept it.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-21 Section 8.2 Test 2 - When format parameter \'CMAX\' is specified, it is an acceptable value.');
  }
  return errors;
};

// ST 2110-22 Section 6 Test 1 - All video streams have an 'rtpmap' attribute with 'jxsv/90000'
const test_22_60_1 = (sdp, params) => {
  let errors = checkStreamsRtpMap(sdp, params, 'jxsv', '90000', 'ST 2110-22 Section 6');
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-22 Section 6 Test 1 - All video streams have an \'rtpmap\' attribute with \'jxsv/90000\'.');
  }
  return errors;
};

const mustHaves22 = ['width', 'height', 'TP']; // Defined as mandatory in ST 2110-22
const mustHaves9134 = ['packetmode']; // Defined as mandatory in RFC 9134

// ST 2110-22 Section 7.2 Test 1 - All format parameters required by ST 2110-22 Section 7.2 and RFC 9134 Section 7.1 are present
const test_22_72_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    let keys = Object.keys(stream);
    for (let param of mustHaves22) {
      if (keys.indexOf(param) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter '${param}' shall be specified, as per ST 2110-22 Section 7.2.`));
      }
    }
    for (let param of mustHaves9134) {
      if (keys.indexOf(param) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter '${param}' must be specified, as per RFC 9134 Section 7.1.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-22 Section 7.2 Test 1 - All format parameters required by ST 2110-22 Section 7.2 and RFC 9134 Section 7.1 are present.');
  }
  return errors;
};

// ST 2110-22 Section 7.2 Test 2 - Format parameters 'width' and 'height' are within bounds
const test_22_72_2 = (sdp, params) => {
  const [mtParams, errors] = extractMTParams(sdp, params);
  for (const stream of mtParams) {
    if (stream.width !== undefined) {
      const width = +stream.width;
      if (isNaN(width) || integerPattern.test(stream.width) === false) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'width' shall be an integer value, as per ST 2110-22 Section 7.2.`));
      } else if (width < 1 || width > 32767) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'width' shall be in the range 1 to 32767 inclusive, but is '${width}', as per ST 2110-22 Section 7.2.`));
      }
    }
    if (stream.height !== undefined) {
      const height = +stream.height;
      if (isNaN(height) || integerPattern.test(stream.height) === false) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'height' shall be an integer value, as per ST 2110-22 Section 7.2.`));
      } else if (height < 1 || height > 32767) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'height' shall be in the range 1 to 32767 inclusive, but is '${height}', as per ST 2110-22 Section 7.2.`));
      }
    }
  }
  if (params.verbose && errors.length === 0) {
    console.log('Test Passed: ST 2110-22 Section 7.2 Test 2 - Format parameters \'width\' and \'height\' are within bounds.');
  }
  return errors;
};

// RFC 9134 Section 7.1 Test 1 - Every stream has format parameters
const test_9134_71_1 = (sdp, params) => {
  let errors = checkStreamsFmtp(sdp, 'RFC 9134 Section 7.1');
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 1 - Every stream has format parameters.');
  }
  return errors;
};

const modesPermitted9134 = ['0', '1'];

// RFC 9134 Section 7.1 Test 2 - Packetization and transmission modes are permitted values
const test_9134_71_2 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    for (let param of ['packetmode', 'transmode']) {
      if (typeof stream[param] !== 'undefined' && modesPermitted9134.indexOf(stream[param]) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter '${param}' must be '0' or '1', but is '${stream[param]}', as per RFC 9134 Section 7.1.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 2 - Packetization and transmission modes are permitted values.');
  }
  return errors;
};

// Profile, level and sublevel names defined by ISO/IEC 21122-2, with white space omitted as per RFC 9134
const profilesPermitted9134 = [
  'HighBayer', 'MainBayer', 'LightBayer',
  'High4444.12', 'Main4444.12', 'High444.12', 'Main444.12', 'Light444.12',
  'Main422.10', 'Light422.10', 'Light-Subline422.10',
  'MLS.12', 'High420.12', 'Main420.12'
];

const levelsPermitted9134 = [
  '1k-1', 'Bayer2k-1', '2k-1', 'Bayer4k-1', '4k-1', 'Bayer8k-1',
  '4k-2', 'Bayer8k-2', '4k-3', 'Bayer8k-3', '8k-1', 'Bayer16k-1',
  '8k-2', 'Bayer16k-2', '8k-3', 'Bayer16k-3', '10k-1', 'Bayer20k-1'
];

const sublevelsPermitted9134 = [
  'Full', 'Sublev12bpp', 'Sublev9bpp', 'Sublev6bpp', 'Sublev4bpp', 'Sublev3bpp', 'Sublev2bpp'
];

// RFC 9134 Section 7.1 Test 3 - JPEG XS profile, level and sublevel are permitted values
const test_9134_71_3 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  let permitted = {
    profile: profilesPermitted9134,
    level: levelsPermitted9134,
    sublevel: sublevelsPermitted9134
  };
  for (let stream of mtParams) {
    for (let param of Object.keys(permitted)) {
      if (typeof stream[param] !== 'undefined' && permitted[param].indexOf(stream[param]) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter '${param}' must be a JPEG XS ${param} defined by ISO/IEC 21122-2, but is '${stream[param]}', as per RFC 9134 Section 7.1.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 3 - JPEG XS profile, level and sublevel are permitted values.');
  }
  return errors;
};

// RFC 9134 Section 7.1 Test 4 - Format parameter 'depth' is a positive integer
const test_9134_71_4 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.depth !== 'undefined' && !integerPattern.test(stream.depth)) {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'depth' must be a positive integer, but is '${stream.depth}', as per RFC 9134 Section 7.1.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 4 - Format parameter \'depth\' is a positive integer.');
  }
  return errors;
};

// RFC 9134 Section 7.1 Test 5 - Format parameters 'interlace' and 'segmented' are name only, and format parameter 'segmented' is signalled with format parameter 'interlace'
const test_9134_71_5 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkInterlace(stream, 'RFC 9134 Section 7.1'));
    errors = errors.concat(checkSegmented(stream, 'RFC 9134 Section 7.1'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 5 - Format parameters \'interlace\' and \'segmented\' are name only, and format parameter \'segmented\' is signalled with format parameter \'interlace\'.');
  }
  return errors;
};

const samplingPermitted9134 = samplingPermitted.concat(['UNSPECIFIED']);

// RFC 9134 Section 7.1 Test 6 - Format parameter 'sampling' is a permitted value
const test_9134_71_6 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkSampling(stream, samplingPermitted9134, 'RFC 9134 Section 7.1'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 6 - Format parameter \'sampling\' is a permitted value.');
  }
  return errors;
};

const colorPermitted9134 = [
  'BT601-5', 'BT709-2', 'SMPTE240M', 'BT601', 'BT709', 'BT2020', 'BT2100',
  'ST2065-1', 'ST2065-3', 'XYZ', 'UNSPECIFIED'
];

// RFC 9134 Section 7.1 Test 7 - Format parameter 'colorimetry' is a permitted value
const test_9134_71_7 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkColorimetry(stream, colorPermitted9134, 'RFC 9134 Section 7.1'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 7 - Format parameter \'colorimetry\' is a permitted value.');
  }
  return errors;
};

// RFC 9134 Section 7.1 Test 8 - Signals using BT.2100 specify format parameter 'RANGE'
const test_9134_71_8 = (sdp, params) => {
  if (!params.should) {
    if (params.verbose) {
      console.log('Test Skipped: RFC 9134 Section 7.1 Test 8 - Signals using BT.2100 specify format parameter \'RANGE\'. Use --should to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkRangeSpecified(stream, 'RFC 9134 Section 7.1'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 8 - Signals using BT.2100 specify format parameter \'RANGE\'.');
  }
  return errors;
};

const tcsPermitted9134 = ['SDR', 'PQ', 'HLG', 'UNSPECIFIED'];

// RFC 9134 Section 7.1 Test 9 - Format parameter 'TCS' is a permitted value
const test_9134_71_9 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkTCS(stream, tcsPermitted9134, 'RFC 9134 Section 7.1'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 9 - Format parameter \'TCS\' is a permitted value.');
  }
  return errors;
};

// RFC 9134 Section 7.1 Test 10 - Format parameter 'RANGE' has acceptable values in colorimetry context
const test_9134_71_10 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    errors = errors.concat(checkRange(stream, 'RFC 9134 Section 7.1'));
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 9134 Section 7.1 Test 10 - Format parameter \'RANGE\' has acceptable values in colorimetry context.');
  }
  return errors;
};

const ssnPermitted22 = ['ST2110-22:2019', 'ST2110-22:2022'];

// ST 2110-22:2022 Section 7.2 Test 1 - Format parameter 'SSN' if present is the required fixed value
const test_22_2022_72_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.SSN !== 'undefined') {
      if (ssnPermitted22.indexOf(stream.SSN) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' shall be 'ST2110-22:2019' or 'ST2110-22:2022', but is '${stream.SSN}', as per ST 2110-22:2022 Section 7.2.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-22:2022 Section 7.2 Test 1 - Format parameter \'SSN\' if present is the required fixed value.');
  }
  return errors;
};

// ST 2110-22 Section 7.3 Test 1 - Mandatory bandwidth field is present and in the correct format
const test_22_73_1 = (sdp, params) => {
  let streams = sdp.split(/[\r\n]m=/);
  let sdpLineNumb = 1;
  let errors = [];

  for (let s = 0; s < streams.length; s++) {
    // First element from sdp.split is the session level section. Just move ahead the sdp line count
    if (s == 0) {
      let lines = splitLines(streams[s]);
      sdpLineNumb += lines.length;
      continue;
    }
    let lines = splitLines(streams[s]);
    let mediaLine = sdpLineNumb;
    let bandwidthPresent = false;
    for (let x = 0; x < lines.length; x++) {
      if (lines[x].startsWith('b=')) {
        let bandwidthMatch = lines[x].match(bandwidthPattern);
        if (bandwidthMatch == null) {
          errors.push(new LineError(sdpLineNumb, `For stream ${s}, bandwidth field ('b=') is not an acceptable pattern, which shall be of the form 'b=<bwtype>:<bandwidth>', as per ST 2110-22 Section 7.3.`));
          sdpLineNumb++;
          continue;
        }
        if (bandwidthMatch[1] != 'AS') {
          errors.push(new LineError(sdpLineNumb, `For stream ${s}, the bandwidth type of bandwidth field ('b=') shall be 'AS', as per ST 2110-22 Section 7.3.`));
        }
        bandwidthPresent = true;
      }
      sdpLineNumb++;
    }
    if (!bandwidthPresent) {
      errors.push(new LineError(mediaLine, `For stream ${s}, a bandwidth field ('b=<bwtype>:<bandwidth>') shall be specified, as per ST 2110-22 Section 7.3.`));
    }
  }

  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-22 Section 7.3 Test 1 - Mandatory bandwidth field is present and in the correct format.');
  }
  return errors;
};

// ST 2110-22 Section 7.4 Test 1 - Frame rate is specified by one of the accepted methods
const test_22_74_1 = (sdp, params) => {
  let streams = sdp.split(/[\r\n]m=/);
  let sdpLineNumb = 1;

  let [mtParams, errors] = extractMTParams(sdp, params);
  if (errors.length != 0) {
    // A stream's format parameters may be missing from mtParams, so its framerate cannot be checked
    return errors;
  }
  for (let s = 0; s < streams.length; s++) {
    let lines = splitLines(streams[s]);
    // RFC 4566 Section 6 Test 1 reports a session-level framerate attribute
    if (s == 0) {
      sdpLineNumb += lines.length;
    }
    // Check each stream for one and only one framerate specification
    else {
      let mediaLine = sdpLineNumb;
      let framerateAttributePresent = false;
      let framerateParameterPresent = false;
      // First check if exactframerate is specified as a parameter of fmtp
      if (mtParams.some(stream => stream._streamNumber == s && stream.exactframerate != null)) {
        framerateParameterPresent = true;
      }
      // Now check if it's present as a media level attribute, which RFC 4566 Section 6 Test 2 checks matches an acceptable pattern
      for (let x = 0; x < lines.length; x++) {
        if (lines[x].startsWith('a=framerate')) {
          framerateAttributePresent = true;
        }
        sdpLineNumb++;
      }
      // If neither exactframerate or framerate attribute present and sessionFramerate not specified, load up error
      if (!framerateAttributePresent && !framerateParameterPresent) {
        errors.push(new LineError(mediaLine, `For stream ${s}, the frame rate shall be specified by attribute 'framerate' or format parameter 'exactframerate', as per ST 2110-22 Section 7.4.`));
      }
      // If both specified then error. ST 2110-22 section 7.4 indicates one method of specifying
      if (framerateAttributePresent && framerateParameterPresent) {
        errors.push(new LineError(mediaLine, `For stream ${s}, the frame rate shall be specified by only one of attribute 'framerate' or format parameter 'exactframerate', as per ST 2110-22 Section 7.4.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-22 Section 7.4 Test 1 - Frame rate is specified by one of the accepted methods.');
  }
  return errors;
};

// ST 2110-22 Section 7.4 Test 2 - Format parameter 'exactframerate' is as specified
const test_22_74_2 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.exactframerate !== 'undefined') {
      errors = errors.concat(checkExactframerate(stream, 'ST 2110-22 Section 7.4'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-22 Section 7.4 Test 2 - Format parameter \'exactframerate\' is as specified.');
  }
  return errors;
};

const ssnPermitted40 = ['ST2110-40:2018', 'ST2110-40:2021', 'ST2110-40:2023'];

// ST 2110-40:2023 Section 7 Test 1 - Format parameter 'SSN' is present when format parameter 'TM' is present, and has the required value
/* Tests for conformance with ST 2110-40:2023:
Senders implementing this standard shall signal a Format Specific Parameter SSN with the value ST2110-40:2018 unless they are signaling Format Specific Parameter TM, in which case they shall signal the value ST2110-40:2023. Receivers shall consider a Format Specific Parameter SSN value of ST2110-40:2021 as equivalent to a value of ST2110-40:2023.
*/
const test_40_2023_7_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    let detect2023tm = typeof stream.TM !== 'undefined';
    // SSN is not required by ST 2110-40:2018, which does not define TM
    if (typeof stream.SSN === 'undefined' && detect2023tm) {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' shall be specified when 'TM' is specified, as per ST 2110-40:2023 Section 7.`));
    }
    if (typeof stream.SSN !== 'undefined') {
      if (ssnPermitted40.indexOf(stream.SSN) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' shall be 'ST2110-40:2018', 'ST2110-40:2021' or 'ST2110-40:2023', but is '${stream.SSN}', as per ST 2110-40:2023 Section 7.`));
      } else {
        if (detect2023tm && stream.SSN === 'ST2110-40:2018') {
          errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' shall be 'ST2110-40:2023' when 'TM' is specified, as per ST 2110-40:2023 Section 7.`));
        }
        if (!detect2023tm && stream.SSN !== 'ST2110-40:2018') {
          errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' shall be 'ST2110-40:2018' when 'TM' is not specified, as per ST 2110-40:2023 Section 7.`));
        }
        if (params.should && stream.SSN === 'ST2110-40:2021') {
          errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'SSN' should be 'ST2110-40:2023' rather than the equivalent 'ST2110-40:2021', as per ST 2110-40:2023 Section 7.`));
        }
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-40:2023 Section 7 Test 1 - Format parameter \'SSN\' is present when format parameter \'TM\' is present, and has the required value.');
  }
  return errors;
};

const tmPermitted40 = ['CTM', 'LLTM'];

// ST 2110-40:2023 Section 7 Test 2 - Format parameter 'TM' if present is the required fixed value
const test_40_2023_7_2 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.TM !== 'undefined') {
      if (tmPermitted40.indexOf(stream.TM) < 0) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TM' shall be 'CTM' or 'LLTM', but is '${stream.TM}', as per ST 2110-40:2023 Section 7.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-40:2023 Section 7 Test 2 - Format parameter \'TM\' if present is the required fixed value.');
  }
  return errors;
};

// ST 2110-40:2023 Section 7 Test 3 - Format parameter 'exactframerate' is present when format parameter 'SSN' is 'ST2110-40:2021' or 'ST2110-40:2023', and is as specified
const test_40_2023_7_3 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.SSN !== 'undefined' && stream.SSN !== 'ST2110-40:2018') {
      if (typeof stream.exactframerate === 'undefined') {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'exactframerate' shall be specified, as per ST 2110-40:2023 Section 7.`));
      } else {
        errors = errors.concat(checkExactframerate(stream, 'ST 2110-40:2023 Section 7 and ST 2110-20:2022 Section 7.2'));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-40:2023 Section 7 Test 3 - Format parameter \'exactframerate\' is present when format parameter \'SSN\' is \'ST2110-40:2021\' or \'ST2110-40:2023\', and is as specified.');
  }
  return errors;
};

// ST 2110-40:2023 Section 7 Test 4 - When format parameter 'TROFF' is specified, it is an acceptable value
const test_40_2023_7_4 = (sdp, params) => {
  if (params.shaping === false) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-40:2023 Section 7 Test 4 - When format parameter \'TROFF\' is specified, it is an acceptable value. Use --shaping to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.TROFF !== 'undefined') {
      errors = errors.concat(checkTroff(stream, 'ST 2110-40:2023 Section 7 and ST 2110-21 Section 8.2'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-40:2023 Section 7 Test 4 - When format parameter \'TROFF\' is specified, it is an acceptable value.');
  }
  return errors;
};

// ST 2110-40:2023 Section 5.3 Test 1 - RTP clock rate is 90 kHz
const test_40_2023_53_1 = (sdp, params) => {
  let errors = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      streamCount++;
      continue;
    }
    let rtpmapMatch = lines[x].match(rtpmapPattern);
    if (rtpmapMatch && rtpmapMatch[2].toLowerCase() === 'smpte291' && rtpmapMatch[3] !== '90000') {
      errors.push(new LineError(x + 1, `For stream ${streamCount}, clock rate shall be '90000', as per ST 2110-40:2023 Section 5.3.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-40:2023 Section 5.3 Test 1 - RTP clock rate is 90 kHz.');
  }
  return errors;
};

const didSdidPattern = /^\{0x[0-9a-f]{1,2},0x[0-9a-f]{1,2}\}$/i;

// RFC 8331 Section 4 Test 1 - When format parameters 'DID_SDID' are specified, they are acceptable values
/* RFC 8331 Section 4 says:
The ABNF as per RFC 5234 [RFC5234] of the DID_SDID optional parameter SHALL be:
        TwoHex = "0x" 1*2(HEXDIG)
        DidSdid = "DID_SDID={" TwoHex "," TwoHex "}"
*/
const test_8331_4_1 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    for (let didSdid of stream.DID_SDID ?? []) {
      if (!didSdidPattern.test(didSdid)) {
        errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'DID_SDID' value '${didSdid}' is not an acceptable pattern, which must be of the form '{0xNN,0xNN}', as per RFC 8331 Section 4.`));
      }
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 8331 Section 4 Test 1 - When format parameters \'DID_SDID\' are specified, they are acceptable values.');
  }
  return errors;
};

// RFC 8331 Section 4 Test 2 - When format parameter 'VPID_Code' is specified, it is an acceptable value
/* RFC 8331 Section 3.1 says the VPID_Code integer is the value of byte 1 of the VPID as defined in SMPTE ST 352,
and Section 4 says it SHALL be present only once, taking a single integer value.
*/
const test_8331_4_2 = (sdp, params) => {
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.VPID_Code === 'undefined') {
      continue;
    }
    if (!/^\d+$/.test(stream.VPID_Code) || +stream.VPID_Code > 255) {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'VPID_Code' must be an integer in the range 0 to 255 inclusive, the value of byte 1 of the VPID, as per RFC 8331 Sections 3.1 and 4.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 8331 Section 4 Test 2 - When format parameter \'VPID_Code\' is specified, it is an acceptable value.');
  }
  return errors;
};

// ST 2022-8 Section 5.3 Test 1 - All video streams have an 'rtpmap' attribute with 'SMPTE2022-6/27000000'
const test_2022_8_53_1 = (sdp, params) => {
  let errors = checkStreamsRtpMap(sdp, params, 'SMPTE2022-6', '27000000', 'ST 2022-8 Section 5.3');
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2022-8 Section 5.3 Test 1 - All video streams have an \'rtpmap\' attribute with \'SMPTE2022-6/27000000\'.');
  }
  return errors;
};

const typesPermitted2022_8 = ['2110TPNL', '2110TPW'];

// ST 2022-8 Section 6 Test 1 - Format parameter 'TP' is specified and is an acceptable value
/* ST 2022-8 Section 6 says:
Senders shall comply with either the "Narrow Linear Senders (Type NL)" requirements, or the "Wide Senders (Type W)"
requirements. [...] Senders shall signal Media Type Parameters TP and TROFF as specified in ST 2110-21.
*/
const test_2022_8_60_1 = (sdp, params) => {
  if (params.shaping === false) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2022-8 Section 6 Test 1 - Format parameter \'TP\' is specified and is an acceptable value. Use --shaping to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  errors = errors.concat(checkStreamsFmtp(sdp, 'ST 2022-8 Section 6'));
  for (let stream of mtParams) {
    if (typeof stream.TP === 'undefined') {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TP' shall be specified, as per ST 2022-8 Section 6.`));
    } else if (typesPermitted2022_8.indexOf(stream.TP) < 0) {
      errors.push(new LineError(stream._line, `For stream ${stream._streamNumber}, format parameter 'TP' shall be '2110TPNL' or '2110TPW', but is '${stream.TP}', as per ST 2022-8 Section 6.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2022-8 Section 6 Test 1 - Format parameter \'TP\' is specified and is an acceptable value.');
  }
  return errors;
};

// ST 2022-8 Section 7.1 Test 1 - When format parameter 'TROFF' is specified, it is an acceptable value
const test_2022_8_71_1 = (sdp, params) => {
  if (params.shaping === false) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2022-8 Section 7.1 Test 1 - When format parameter \'TROFF\' is specified, it is an acceptable value. Use --shaping to test.');
    }
    return [];
  }
  let [mtParams, errors] = extractMTParams(sdp, params);
  for (let stream of mtParams) {
    if (typeof stream.TROFF !== 'undefined') {
      errors = errors.concat(checkTroff(stream, 'ST 2022-8 Section 7.1 and ST 2110-21 Section 8.2'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2022-8 Section 7.1 Test 1 - When format parameter \'TROFF\' is specified, it is an acceptable value.');
  }
  return errors;
};

// Collect the rtpmap of each stream with encoding name 'ttml+xml' for a format of the media description,
// and the fmtp with the same payload type, as 'rtpmap' and 'fmtp' may be in either order
const extractTTMLStreams = sdp => {
  let streams = [];
  let lines = splitLines(sdp);
  let streamCount = 0;
  let mediaLine = 0;
  let payloadTypes = [];
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      streamCount++;
      mediaLine = x + 1;
      payloadTypes = lines[x].trim().split(/\s+/).slice(3).map(Number);
      continue;
    }
    // Payload types that are not formats of the media description are reported by test_10_62_2
    if (lines[x].startsWith('a=rtpmap') && streamCount > 0) {
      let rtpmapMatch = lines[x].match(rtpmapPattern);
      if (rtpmapMatch && payloadTypes.includes(+rtpmapMatch[1]) && rtpmapMatch[2].toLowerCase() === 'ttml+xml') {
        streams.push({
          streamNumber: streamCount,
          mediaLine,
          payloadType: +rtpmapMatch[1],
          rtpmapLine: x + 1,
          clockRate: rtpmapMatch[3],
          fmtpLine: null,
          codecs: null,
          charset: null,
          profile: null
        });
      }
    }
  }
  streamCount = 0;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      streamCount++;
      continue;
    }
    let fmtpMatch = lines[x].match(/^a=fmtp:(\d+)/);
    let stream = fmtpMatch && streams.find(s => s.streamNumber === streamCount && s.payloadType === +fmtpMatch[1]);
    if (stream) {
      let codecsMatch = lines[x].match(codecsPattern);
      let charsetMatch = lines[x].match(charsetPattern);
      let profileMatch = lines[x].match(profilePattern);
      stream.fmtpLine = x + 1;
      stream.codecs = codecsMatch ? codecsMatch[1] : null;
      stream.charset = charsetMatch ? charsetMatch[1] ?? '' : null;
      stream.profile = profileMatch ? profileMatch[1] ?? '' : null;
    }
  }
  return streams;
};

// ST 2110-43:2021 Section 4.1 Test 1 - TTML streams have an 'fmtp' attribute with format parameter 'codecs'
/* RFC 8759 Section 11.2 says:
The "codecs" parameter MUST be included in the "a=fmtp" line of the SDP file.
*/
const test_43_2021_41_1 = (sdp, params) => {
  let errors = [];
  for (let stream of extractTTMLStreams(sdp)) {
    if (stream.fmtpLine === null) {
      errors.push(new LineError(stream.mediaLine, `For stream ${stream.streamNumber}, an 'fmtp' attribute with format parameter 'codecs' shall be specified, as per ST 2110-43:2021 Section 4.1 and RFC 8759 Section 11.2.`));
    } else if (stream.codecs === null) {
      errors.push(new LineError(stream.fmtpLine, `For stream ${stream.streamNumber}, format parameter 'codecs' shall be specified, as per ST 2110-43:2021 Section 4.1 and RFC 8759 Section 11.2.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-43:2021 Section 4.1 Test 1 - TTML streams have an \'fmtp\' attribute with format parameter \'codecs\'.');
  }
  return errors;
};

// ST 2110-43:2021 Section 4.2 Test 1 - TTML streams have a 90 kHz RTP clock
const test_43_2021_42_1 = (sdp, params) => {
  let errors = [];
  for (let stream of extractTTMLStreams(sdp)) {
    if (stream.clockRate !== '90000') {
      errors.push(new LineError(stream.rtpmapLine, `For stream ${stream.streamNumber}, clock rate shall be '90000', as per ST 2110-43:2021 Section 4.2.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: ST 2110-43:2021 Section 4.2 Test 1 - TTML streams have a 90 kHz RTP clock.');
  }
  return errors;
};

// RFC 8759 Section 11.2 Test 1 - TTML format parameters 'charset' and 'profile' have permitted values
// The 'application/ttml+xml' media type registration defines the optional parameters 'charset' and 'profile'
const test_8759_112_1 = (sdp, params) => {
  let errors = [];
  for (let stream of extractTTMLStreams(sdp)) {
    // Character set names are case-insensitive
    if (stream.charset !== null && !/^utf-(?:8|16)$/i.test(stream.charset)) {
      errors.push(new LineError(stream.fmtpLine, `For stream ${stream.streamNumber}, format parameter 'charset' must be 'UTF-8' or 'UTF-16', but is '${stream.charset}', ` +
        'as per RFC 8759 Section 11.2 and the \'application/ttml+xml\' media type registration.'));
    }
    if (stream.profile === '') {
      errors.push(new LineError(stream.fmtpLine, `For stream ${stream.streamNumber}, format parameter 'profile' must be a profile designator, which is a URI, ` +
        'as per RFC 8759 Section 11.2 and the \'application/ttml+xml\' media type registration.'));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: RFC 8759 Section 11.2 Test 1 - TTML format parameters \'charset\' and \'profile\' have permitted values.');
  }
  return errors;
};

const section_10_62 = (sdp, params) => {
  let tests = [test_10_62_1, test_10_62_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_10_74 = (sdp, params) => {
  let tests = [test_10_74_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_10_81 = (sdp, params) => {
  let tests = [test_10_81_1, test_10_81_2, test_10_81_3];
  return tests.flatMap(t => t(sdp, params));
};

const section_10_82 = (sdp, params) => {
  let tests = [test_10_82_1, test_10_2022_82_1, test_10_82_3, test_10_82_4];
  return tests.flatMap(t => t(sdp, params));
};

const section_10_83 = (sdp, params) => {
  let tests = [test_10_83_1, test_10_83_2, test_10_83_3];
  return tests.flatMap(t => t(sdp, params));
};

const section_23_53 = (sdp, params) => {
  let tests = [test_23_53_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_10_86 = (sdp, params) => {
  let tests = [test_10_84_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_10_2022_83 = (sdp, params) => {
  let tests = [test_10_2022_83_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_10_2022_84 = (sdp, params) => {
  let tests = [test_10_2022_84_1, test_10_2022_84_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_10_2022_87 = (sdp, params) => {
  let tests = [test_10_2022_87_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_20_71 = (sdp, params) => {
  let tests = [test_20_71_3, test_20_71_4];
  return tests.flatMap(t => t(sdp, params));
};

const section_20_72 = (sdp, params) => {
  let tests = [test_20_72_1, test_20_72_2, test_20_72_3, test_20_72_4,
    test_20_72_5];
  return tests.flatMap(t => t(sdp, params));
};

const section_20_73 = (sdp, params) => {
  let tests = [test_20_73_1, test_20_73_2, test_20_73_3, test_20_73_4];
  return tests.flatMap(t => t(sdp, params));
};

const section_20_74 = (sdp, params) => {
  let tests = [test_20_74_1, test_20_74_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_20_75 = (sdp, params) => {
  let tests = [test_20_75_1, test_20_75_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_20_76 = (sdp, params) => {
  let tests = [test_20_76_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_30_62 = (sdp, params) => {
  let tests = [test_30_62_1, test_30_62_3, test_30_62_4];
  return tests.flatMap(t => t(sdp, params));
};

const section_31_61 = (sdp, params) => {
  let tests = [test_31_61_1, test_31_61_2, test_31_61_3];
  return tests.flatMap(t => t(sdp, params));
};

const section_31_62 = (sdp, params) => {
  let tests = [test_31_62_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_21_81 = (sdp, params) => {
  let tests = [test_21_81_1, test_21_81_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_21_82 = (sdp, params) => {
  let tests = [test_21_82_1, test_21_82_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_22_60 = (sdp, params) => {
  let tests = [test_22_60_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_22_72 = (sdp, params) => {
  let tests = [test_22_72_1, test_22_72_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_22_73 = (sdp, params) => {
  let tests = [test_22_73_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_22_74 = (sdp, params) => {
  let tests = [test_22_74_1, test_22_74_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_22_2022_72 = (sdp, params) => {
  let tests = [test_22_2022_72_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_9134_71 = (sdp, params) => {
  let tests = [test_9134_71_1, test_9134_71_2, test_9134_71_3, test_9134_71_4,
    test_9134_71_5, test_9134_71_6, test_9134_71_7, test_9134_71_8,
    test_9134_71_9, test_9134_71_10];
  return tests.flatMap(t => t(sdp, params));
};

const section_40_2023_7 = (sdp, params) => {
  let tests = [test_40_2023_7_1, test_40_2023_7_2, test_40_2023_7_3, test_40_2023_7_4];
  return tests.flatMap(t => t(sdp, params));
};

const section_40_2023_53 = (sdp, params) => {
  let tests = [test_40_2023_53_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_2022_8_53 = (sdp, params) => {
  let tests = [test_2022_8_53_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_2022_8_60 = (sdp, params) => {
  let tests = [test_2022_8_60_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_2022_8_71 = (sdp, params) => {
  let tests = [test_2022_8_71_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_8331_4 = (sdp, params) => {
  let tests = [test_8331_4_1, test_8331_4_2];
  return tests.flatMap(t => t(sdp, params));
};

const section_43_2021_41 = (sdp, params) => {
  let tests = [test_43_2021_41_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_43_2021_42 = (sdp, params) => {
  let tests = [test_43_2021_42_1];
  return tests.flatMap(t => t(sdp, params));
};

const section_8759_112 = (sdp, params) => {
  let tests = [test_8759_112_1];
  return tests.flatMap(t => t(sdp, params));
};

const no_copy = (sdp, params, specSDP, test, example) => {
  if (params.noCopy === false) {
    if (params.verbose) {
      console.log(`Test Skipped: ${test} - The SDP file is not a copy of the example. Use --noCopy to test.`);
    }
    return [];
  }
  let lines = splitLines(sdp.trim()).filter(line => line !== '');
  let exlines = splitLines(specSDP);
  let length = lines.length < exlines.length ? lines.length : exlines.length;
  let matching = true;
  for (let x = 0; x < length; x++) {
    if (!lines[x].replace(/\s+/g, ' ').startsWith(exlines[x])) {
      matching = false;
      break;
    }
  }
  if (matching) {
    return [new Error(`The SDP file must not be a copy of the example in ${example}, as requested by --noCopy.`)];
  }
  if (params.verbose) {
    console.log(`Test Passed: ${test} - The SDP file is not a copy of the example.`);
  }
  return [];
};

// ST 2110-10 Annex B Test 1 - The SDP file is not a copy of the example
const no_copy_20 = (sdp, params) => {
  return no_copy(sdp, params, specExample20, 'ST 2110-10 Annex B Test 1', 'ST 2110-10 Annex B');
};

// ST 2110-10:2022 Annex B Test 1 - The SDP file is not a copy of the example
const no_copy_20_2022 = (sdp, params) => {
  return no_copy(sdp, params, specExample20_2022, 'ST 2110-10:2022 Annex B Test 1', 'ST 2110-10:2022 Annex B');
};

// VSF TR-08:2022 Appendix A Test 1 - The SDP file is not a copy of the example
const no_copy_22 = (sdp, params) => {
  return no_copy(sdp, params, specExample22, 'VSF TR-08:2022 Appendix A Test 1', 'VSF TR-08:2022 Appendix A');
};

// ST 2110-10 Section 8.1 Test 4 - The SDP file includes at least one media description
// RFC 4566 Section 5 allows an SDP file with no media descriptions, but ST 2110-10 Section 8.1 requires an SDP file for each RTP stream
const no_media = (sdp, params) => {
  if (params.noMedia === false) {
    if (params.verbose) {
      console.log('Test Skipped: ST 2110-10 Section 8.1 Test 4 - The SDP file includes at least one media description. Use --noMedia to test.');
    }
    return [];
  }
  let lines = splitLines(sdp);
  let hasMedia = false;
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].startsWith('m=')) {
      hasMedia = true;
      break;
    }
  }
  if (!hasMedia) {
    return [new LineError(lines.length, 'An SDP file shall include at least one media description (\'m=\'), as per ST 2110-10 Section 8.1.')];
  }
  if (params.verbose) {
    console.log('Test Passed: ST 2110-10 Section 8.1 Test 4 - The SDP file includes at least one media description.');
  }
  return [];
};

const st2110_10_sections = [
  section_10_62,
  section_10_74,
  section_10_81,
  section_10_82,
  section_10_83,
  section_10_86,
  section_10_2022_83,
  section_10_2022_84,
  section_10_2022_87,
  section_23_53,
  no_media,
];

// The stream that the tests of the essence are chosen from, which is the first stream whose encoding name is known
const essenceStreamOf = streams => streams.find(stream => encodingNameOf(stream) !== undefined) ?? streams[0];

// SDPoker Test 1 - The SDP file describes a single essence
// The tests for each essence are chosen from the media description that essenceStreamOf finds, so further
// media descriptions are only supported as ST 2022-7 redundant streams of the same essence
const checkSingleEssence = (sdp, params) => {
  let errors = [];
  let streams = extractStreams(sdp);
  let reference = essenceStreamOf(streams);
  let essence = stream => encodingNameOf(stream) ? `${stream.mediaType}/${encodingNameOf(stream)}` : stream.mediaType;
  for (let stream of streams.filter(stream => stream !== reference)) {
    // Encoding names are case-insensitive, as per RFC 4855 Section 3
    if (stream.mediaType !== reference.mediaType ||
      (encodingNameOf(stream) && encodingNameOf(reference) &&
        encodingNameOf(stream).toLowerCase() !== encodingNameOf(reference).toLowerCase())) {
      errors.push(new LineError(stream.line, `For stream ${stream.streamNumber}, the essence '${essence(stream)}' differs from the essence '${essence(reference)}' of stream ${reference.streamNumber}. SDPoker only checks SDP files that describe a single essence, with more than one media description only for ST 2022-7 redundant streams.`));
    }
  }
  if (params.verbose && errors.length == 0) {
    console.log('Test Passed: SDPoker Test 1 - The SDP file describes a single essence.');
  }
  return errors;
};

const allSections = (sdp, params) => {
  // The array of test functions, defaulting to ST 2110-10 tests. May be overridden below.
  let sections = st2110_10_sections;
  // Pull out the media type
  let [, errors] = extractMTParams(sdp, params);
  if (errors.length != 0) {
    return errors;
  }
  errors = checkSingleEssence(sdp, params);
  if (errors.length != 0) {
    return errors;
  }
  // Load tests for video, audio or application mediaTypes
  let stream = essenceStreamOf(extractStreams(sdp));
  let mediaType = stream?.mediaType;
  let encodingName = stream && encodingNameOf(stream);
  if (mediaType == 'video') {
    // Load tests based on encoding name
    if (encodingName == 'jxsv') {
      sections = [
        ...st2110_10_sections,
        section_21_81, section_21_82,
        section_22_60, section_22_72, section_22_73, section_22_74, section_22_2022_72,
        section_9134_71, no_copy_22];
    } else if (encodingName == 'raw') {
      sections = [
        ...st2110_10_sections,
        section_20_71, section_20_72, section_20_73, section_20_74,
        section_20_75, section_20_76, section_21_81, section_21_82, no_copy_20, no_copy_20_2022];
    } else if (encodingName == 'smpte291') {
      sections = [
        ...st2110_10_sections,
        section_40_2023_53, section_40_2023_7, section_8331_4];
    } else if (encodingName == 'SMPTE2022-6') {
      sections = [
        ...st2110_10_sections,
        section_2022_8_53, section_2022_8_60, section_2022_8_71];
    }
  } else if (mediaType == 'audio') {
    if (encodingName == 'AM824') {
      sections = [
        ...st2110_10_sections,
        section_31_61, section_31_62];
    } else {
      sections = [
        ...st2110_10_sections,
        section_30_62];
    }
  } else if (mediaType == 'application') {
    // Encoding names are case-insensitive, as per RFC 4855 Section 3
    if (typeof encodingName === 'string' && encodingName.toLowerCase() === 'ttml+xml') {
      sections = [
        ...st2110_10_sections,
        section_43_2021_41, section_43_2021_42, section_8759_112];
    }
  }

  return sections.flatMap(s => s(sdp, params));
};

module.exports = {
  allSections,
  section_10_62,
  section_10_74,
  section_10_81,
  section_10_82,
  section_10_83,
  section_10_86,
  section_10_2022_83,
  section_10_2022_84,
  section_10_2022_87,
  section_20_71,
  section_20_72,
  section_20_73,
  section_20_74,
  section_20_75,
  section_20_76,
  section_22_60,
  section_22_72,
  section_22_73,
  section_22_74,
  section_22_2022_72,
  section_21_81,
  section_21_82,
  section_31_61,
  section_31_62,
  section_9134_71,
  section_40_2023_53,
  section_40_2023_7,
  section_8331_4,
  section_2022_8_53,
  section_2022_8_60,
  section_2022_8_71,
  section_43_2021_41,
  section_43_2021_42,
  section_8759_112,
  section_23_53
};

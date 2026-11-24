const fs = require('fs');
const path = require('path');
const test = require('tape');
const { checkRFC4566, checkRFC4570, checkST2110 } = require('../index.js');
const { section_22_74, section_40_2023_7, section_8331_4, section_2022_8_71 } = require('../checkST2110.js');

// Mirror sdpoker.js default CLI options so library tests match CLI behaviour.
const cliDefaults = {
  checkEndings: false, should: false, noCopy: true, noMedia: true,
  duplicate: false,
  skipRFC4566: false, skipRFC4570: false, skipST2110: false,
  channelOrder: false, useIP4: false, useIP6: false,
  multicast: false, unicast: false, shaping: true, midLast: false, verbose: false
};
const fixturesRoot = path.join(__dirname, 'fixtures');
const validFixturesDir = path.join(fixturesRoot, 'valid');

function runAllChecks(sdp, params = cliDefaults) {
  if (params.skipRFC4566 && params.skipRFC4570 && params.skipST2110) {
    throw new Error('All checks have been skipped');
  }

  let errors = [];
  if (!params.skipRFC4566) {
    errors = errors.concat(checkRFC4566(sdp, params));
  }
  if (!params.skipRFC4570) {
    errors = errors.concat(checkRFC4570(sdp, params));
  }
  if (!params.skipST2110) {
    errors = errors.concat(checkST2110(sdp, params));
  }
  return errors;
}

function readFixture(relativePath) {
  return fs.readFileSync(path.join(fixturesRoot, relativePath), 'utf8');
}

const validFixtures = fs.readdirSync(validFixturesDir)
  .filter(fileName => fileName.endsWith('.sdp'))
  .sort();

const invalidCases = [
  {
    file: 'invalid/aes67-mcast.sdp',
    params: { should: true },
    messageIncludes: 'For stream 1, destination address \'239.0.0.1\' is multicast, so an inclusive \'source-filter\' attribute should be included'
  },
  {
    file: 'invalid/st2022-6.sdp',
    messageIncludes: 'mediaclk'
  },
  {
    file: 'invalid/line-endings-lf.sdp',
    params: { checkEndings: true },
    messageIncludes: 'and CR and LF must not appear separately, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/line-endings-cr.sdp',
    params: { checkEndings: true },
    messageIncludes: 'and CR and LF must not appear separately, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/line-endings-mixed.sdp',
    params: { checkEndings: true },
    messageIncludes: 'and CR and LF must not appear separately, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/line-endings-final-cr.sdp',
    params: { checkEndings: true },
    messageIncludes: 'and CR and LF must not appear separately, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/no-final-line-ending.sdp',
    messageIncludes: 'The last record of an SDP file must end with a newline character, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/blank-line.sdp',
    messageIncludes: 'An SDP file must not contain blank lines, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/blank-first-line.sdp',
    messageIncludes: 'An SDP file must not contain blank lines, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/missing-v0.sdp',
    messageIncludes: 'first line must be \'v=0\''
  },
  {
    file: 'invalid/bad-line-format.sdp',
    messageIncludes: 'form \'<type>=<value>\''
  },
  {
    file: 'invalid/origin-pattern.sdp',
    messageIncludes: 'Origin field (\'o=\') is not an acceptable pattern'
  },
  {
    file: 'invalid/connection-pattern.sdp',
    messageIncludes: 'Connection data field (\'c=\') is not an acceptable pattern'
  },
  {
    file: 'invalid/media-pattern.sdp',
    messageIncludes: 'Media field (\'m=\') is not an acceptable pattern'
  },
  {
    file: 'invalid/ts-refclk-pattern.sdp',
    messageIncludes: 'Attribute \'ts-refclk\' is not an acceptable pattern'
  },
  {
    file: 'invalid/source-filter-value-pattern.sdp',
    messageIncludes: 'Attribute \'source-filter\' is not an acceptable pattern'
  },
  {
    file: 'invalid/fmtp-pattern.sdp',
    messageIncludes: 'attribute \'fmtp\' is not an acceptable pattern'
  },
  {
    file: 'invalid/time-pattern.sdp',
    messageIncludes: 'Timing field (\'t=\') is not an acceptable pattern'
  },
  {
    file: 'invalid/bandwidth-pattern.sdp',
    messageIncludes: 'Bandwidth field (\'b=\') is not an acceptable pattern'
  },
  {
    file: 'invalid/rtpmap-pattern.sdp',
    messageIncludes: 'attribute \'rtpmap\' is not an acceptable pattern'
  },
  {
    file: 'invalid/mediaclk-pattern.sdp',
    messageIncludes: 'attribute \'mediaclk\' is not an acceptable pattern'
  },
  {
    file: 'invalid/mediaclk-direct-rate.sdp',
    messageIncludes: 'attribute \'mediaclk\' is not an acceptable pattern, which must be of the form \'a=mediaclk:direct[=<offset>] [rate=<numerator>/<denominator>]\''
  },
  {
    file: 'invalid/source-filter-pattern.sdp',
    messageIncludes: 'Attribute \'source-filter\' is not an acceptable pattern'
  },
  {
    file: 'invalid/bad-maxudp.sdp',
    messageIncludes: 'MAXUDP'
  },
  {
    file: 'invalid/missing-media.sdp',
    messageIncludes: 'shall include at least one media description (\'m=\')'
  },
  {
    file: 'invalid/missing-ts-refclk.sdp',
    messageIncludes: 'ts-refclk'
  },
  {
    file: 'invalid/st2110-20-fmtp-first.sdp',
    messageIncludes: 'format parameter \'SSN\' shall be specified'
  },
  {
    file: 'invalid/st2022-8-clock-rate.sdp',
    messageIncludes: 'For stream 1, clock rate shall be \'27000000\', as per ST 2022-8 Section 5.3'
  },
  {
    file: 'invalid/st2022-8-missing-tp.sdp',
    messageIncludes: 'For stream 1, format parameter \'TP\' shall be specified, as per ST 2022-8 Section 6'
  },
  {
    file: 'invalid/st2022-8-tp.sdp',
    messageIncludes: 'For stream 1, format parameter \'TP\' shall be \'2110TPNL\' or \'2110TPW\''
  },
  {
    file: 'invalid/st2022-8-dup-missing-tp.sdp',
    params: { shaping: true, duplicate: true },
    messageIncludes: 'For stream 2, an \'fmtp\' attribute shall be specified, as per ST 2022-8 Section 6'
  },
  {
    file: 'invalid/st2022-8-troff.sdp',
    params: { shaping: true },
    messageIncludes: 'For stream 1, format parameter \'TROFF\' is \'-37\', a negative transmit offset'
  },
  {
    file: 'invalid/st2110-40-ssn.sdp',
    messageIncludes: 'format parameter \'SSN\' shall be \'ST2110-40:2023\' when \'TM\' is specified, as per ST 2110-40:2023 Section 7'
  },
  {
    file: 'invalid/st2110-40-clock-rate.sdp',
    messageIncludes: 'For stream 1, clock rate shall be \'90000\', as per ST 2110-40:2023 Section 5.3'
  },
  {
    file: 'invalid/st2110-40-2018-clock-rate.sdp',
    messageIncludes: 'For stream 1, clock rate shall be \'90000\', as per ST 2110-40:2023 Section 5.3'
  },
  {
    file: 'invalid/st2110-40-did-sdid.sdp',
    messageIncludes: 'format parameter \'DID_SDID\' value \'{0x141,0x05}\' is not an acceptable pattern, which must be of the form \'{0xNN,0xNN}\', as per RFC 8331 Section 4'
  },
  {
    file: 'invalid/st2110-40-did-sdid-no-value.sdp',
    messageIncludes: 'format parameter \'DID_SDID\' value \'\' is not an acceptable pattern, which must be of the form \'{0xNN,0xNN}\', as per RFC 8331 Section 4'
  },
  {
    file: 'invalid/st2110-40-vpid-code.sdp',
    messageIncludes: 'format parameter \'VPID_Code\' must be an integer in the range 0 to 255 inclusive, the value of byte 1 of the VPID, as per RFC 8331 Sections 3.1 and 4'
  },
  {
    file: 'invalid/st2110-40-fmtp-first.sdp',
    messageIncludes: 'format parameter \'TM\' shall be \'CTM\' or \'LLTM\''
  },
  {
    file: 'invalid/rtpmap-payload-type.sdp',
    messageIncludes: 'payload type \'106\' of attribute \'rtpmap\' must be a format of the media description'
  },
  {
    file: 'invalid/fmtp-payload-type.sdp',
    messageIncludes: 'payload type \'106\' of attribute \'fmtp\' must be a format of the media description'
  },
  {
    file: 'invalid/missing-rtpmap.sdp',
    messageIncludes: 'dynamic payload type \'105\' shall have an \'rtpmap\' attribute'
  },
  {
    file: 'invalid/st2110-20-missing-rtpmap.sdp',
    messageIncludes: 'For stream 2, dynamic payload type \'97\' shall have an \'rtpmap\' attribute',
    messageExcludes: 'does not have an \'rtpmap\' attribute'
  },
  {
    file: 'invalid/st2110-30-missing-rtpmap.sdp',
    messageIncludes: 'dynamic payload type \'102\' shall have an \'rtpmap\' attribute',
    messageExcludes: 'required attribute \'rtpmap\' is missing'
  },
  {
    file: 'invalid/st2110-30-encoding-name.sdp',
    messageIncludes: 'attribute \'rtpmap\' is not an acceptable pattern',
    messageExcludes: 'required attribute \'rtpmap\' is missing'
  },
  {
    file: 'invalid/st2110-31-clock-rate.sdp',
    messageIncludes: 'For stream 1, the sampling rate in attribute \'rtpmap\' shall be \'44100\', \'48000\' or \'96000\', but is \'32000\', as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-channels.sdp',
    messageIncludes: 'For stream 1, attribute \'rtpmap\' shall specify an even number of AES3 subframe sequences, but specifies \'3\', as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-missing-ptime.sdp',
    messageIncludes: 'For stream 1, attribute \'ptime\' shall be specified, as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-ptime.sdp',
    messageIncludes: 'For stream 1, attribute \'ptime\' shall be a packet time permitted for clock rate \'48000\', but is \'0.125\', as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-44100-ptime.sdp',
    messageIncludes: 'For stream 1, attribute \'ptime\' shall be a packet time permitted for clock rate \'44100\', but is \'1\', as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-channel-order.sdp',
    messageIncludes: 'For stream 1, format parameter \'channel-order\' is not an acceptable pattern, as per ST 2110-31 Section 6.2'
  },
  {
    file: 'invalid/st2110-43-missing-fmtp.sdp',
    messageIncludes: 'Line 5: For stream 1, an \'fmtp\' attribute with format parameter \'codecs\' shall be specified'
  },
  {
    file: 'invalid/st2110-43-missing-codecs.sdp',
    messageIncludes: 'format parameter \'codecs\' shall be specified'
  },
  {
    file: 'invalid/st2110-43-fmtp-payload-type.sdp',
    messageIncludes: 'Line 5: For stream 1, an \'fmtp\' attribute with format parameter \'codecs\' shall be specified'
  },
  {
    file: 'invalid/st2110-43-rtpmap-payload-type.sdp',
    messageIncludes: 'payload type \'113\' of attribute \'rtpmap\'',
    messageExcludes: 'clock rate shall be 90000Hz'
  },
  {
    file: 'invalid/st2110-43-clock-rate.sdp',
    messageIncludes: 'clock rate shall be \'90000\', as per ST 2110-43'
  },
  {
    file: 'invalid/st2110-43-upper-case-encoding-name.sdp',
    messageIncludes: 'clock rate shall be \'90000\', as per ST 2110-43'
  },
  {
    file: 'invalid/st2110-22-missing-fmtp.sdp',
    messageIncludes: 'Line 6: For stream 1, the frame rate shall be specified by attribute \'framerate\' or format parameter \'exactframerate\''
  },
  {
    file: 'invalid/st2110-22-missing-fmtp.sdp',
    messageIncludes: 'For stream 1, an \'fmtp\' attribute shall be specified'
  },
  {
    file: 'invalid/st2110-22-transmode.sdp',
    messageIncludes: 'format parameter \'transmode\' must be \'0\' or \'1\''
  },
  {
    file: 'invalid/st2110-22-profile-level-sublevel.sdp',
    messageIncludes: 'format parameter \'profile\' must be a JPEG XS profile defined by ISO/IEC 21122-2'
  },
  {
    file: 'invalid/st2110-22-profile-level-sublevel.sdp',
    messageIncludes: 'format parameter \'level\' must be a JPEG XS level defined by ISO/IEC 21122-2'
  },
  {
    file: 'invalid/st2110-22-profile-level-sublevel.sdp',
    messageIncludes: 'format parameter \'sublevel\' must be a JPEG XS sublevel defined by ISO/IEC 21122-2'
  },
  {
    file: 'invalid/st2110-22-depth.sdp',
    messageIncludes: 'format parameter \'depth\' must be a positive integer'
  },
  {
    file: 'invalid/st2110-22-segmented.sdp',
    messageIncludes: 'format parameter \'interlace\' must be specified when \'segmented\' is specified, as per RFC 9134 Section 7.1'
  },
  {
    file: 'invalid/st2110-22-sampling.sdp',
    messageIncludes: 'format parameter \'sampling\' must be a permitted value'
  },
  {
    file: 'invalid/st2110-22-colorimetry.sdp',
    messageIncludes: 'format parameter \'colorimetry\' must be a permitted value'
  },
  {
    file: 'invalid/st2110-22-tcs.sdp',
    messageIncludes: 'format parameter \'TCS\' (Transfer Characteristic System) must be a permitted value'
  },
  {
    file: 'invalid/st2110-22-range.sdp',
    messageIncludes: 'must be \'FULL\' or \'NARROW\' when \'colorimetry\' is \'BT2100\''
  },
  {
    file: 'invalid/st2110-22-exactframerate.sdp',
    messageIncludes: 'parameter \'exactframerate\' shall be a single integer for an integer frame rate, as per ST 2110-22 Section 7.4'
  },
  {
    file: 'invalid/st2110-mixed-essence.sdp',
    messageIncludes: 'For stream 2, the essence \'audio/L24\' differs from the essence \'video/raw\' of stream 1'
  },
  {
    file: 'invalid/st2110-mixed-encoding.sdp',
    messageIncludes: 'For stream 2, the essence \'video/jxsv\' differs from the essence \'video/raw\' of stream 1'
  }
];

test('valid SDP fixtures pass default checks and have CRLF line endings', t => {
  t.plan(validFixtures.length);

  for (const fileName of validFixtures) {
    const sdp = fs.readFileSync(path.join(validFixturesDir, fileName), 'utf8');
    const errors = runAllChecks(sdp, { ...cliDefaults, checkEndings: true });

    t.same(
      errors,
      [],
      `${fileName} passes default checks and has CRLF line endings`
    );
  }
});

test('invalid SDP fixtures are rejected', t => {
  t.plan(invalidCases.length * 2 + invalidCases.filter(invalidCase => invalidCase.messageExcludes).length);

  for (const invalidCase of invalidCases) {
    const sdp = readFixture(invalidCase.file);
    const errors = runAllChecks(sdp, { ...cliDefaults, ...invalidCase.params });
    const messages = errors.map(error => error.message).join(' ');

    t.ok(errors.length > 0, `${invalidCase.file} should fail validation`);
    t.ok(
      messages.includes(invalidCase.messageIncludes),
      `${invalidCase.file} reports an error mentioning "${invalidCase.messageIncludes}"`
    );
    if (invalidCase.messageExcludes) {
      t.notOk(
        messages.includes(invalidCase.messageExcludes),
        `${invalidCase.file} does not report an error mentioning "${invalidCase.messageExcludes}"`
      );
    }
  }
});

test('the ST 2110-10:2022 Annex B example is reported only as a copy and for its missing TP parameters', t => {
  const messages = runAllChecks(readFixture('invalid/st2110-10-annex-b.sdp')).map(error => error.message);
  t.same(messages, [
    'Line 12: For stream 1, format parameter \'TP\' shall be specified, as per ST 2110-21 Section 8.1.',
    'Line 20: For stream 2, format parameter \'TP\' shall be specified, as per ST 2110-21 Section 8.1.',
    'The SDP file must not be a copy of the example in ST 2110-10:2022 Annex B, as requested by --noCopy.'
  ]);
  t.end();
});

test('an origin or connection data field that is not the IP version requested is reported once', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const messages = (variant, params) => checkRFC4566(variant, { ...cliDefaults, ...params }).map(error => error.message);
  const origin = sdp.replace(/IN IP4 172\.29\.80\.65/, 'IN IP6 2001:db8::1');
  const connection = sdp.replace('c=IN IP4 232.80.177.113/32', 'c=IN IP6 ff3e::8000:1');

  t.same(messages(origin, { useIP4: true }), ['Line 2: Origin field (\'o=\') address \'2001:db8::1\' must be an IPv4 address, as requested by --useIP4.']);
  t.same(messages(sdp, { useIP6: true }).filter(message => message.startsWith('Line 2:')),
    ['Line 2: Origin field (\'o=\') address \'172.29.80.65\' must be an IPv6 address, as requested by --useIP6.']);
  t.same(messages(connection, { useIP4: true }), ['Line 6: Connection data field (\'c=\') address \'ff3e::8000:1\' must be an IPv4 address, as requested by --useIP4.']);
  t.same(messages(sdp, { useIP6: true }).filter(message => message.startsWith('Line 6:')),
    ['Line 6: Connection data field (\'c=\') address \'232.80.177.113\' must be an IPv6 address, as requested by --useIP6.']);
  t.same(messages(origin, {}), [], 'an IPv6 origin passes when no IP version is requested');
  t.end();
});

test('a multicast connection address is reported in quotes when unicast is requested', t => {
  const messages = runAllChecks(readFixture('valid/st2110-20.sdp'), { ...cliDefaults, unicast: true }).map(error => error.message);
  t.ok(messages.includes('Line 6: Connection data field (\'c=\') address \'232.80.177.113\' must be a unicast address, as requested by --unicast.'));
  t.end();
});

test('ts-refclk PTP grandmaster identities can use lower-case hex digits', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const variant = sdp.replace(/a=ts-refclk:[^\r\n]*/, 'a=ts-refclk:ptp=IEEE1588-2008:39-a7-94-ff-fe-07-cb-d0:37');
  t.same(runAllChecks(variant).map(error => error.message), []);
  t.end();
});

test('ts-refclk attributes can use the RFC 7273 forms for devices not referenced to IEEE 1588-2008', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const messages = refclk => checkST2110(sdp.replace(/a=ts-refclk:[^\r\n]*/, refclk), cliDefaults).map(error => error.message);
  for (const refclk of [
    'a=ts-refclk:ntp=203.0.113.10',
    'a=ts-refclk:ntp=/traceable/',
    'a=ts-refclk:ptp=IEEE1588-2002:39-A7-94-FF-FE-07-CB-D0',
    'a=ts-refclk:ptp=IEEE802.1AS-2011:39-A7-94-FF-FE-07-CB-D0',
    'a=ts-refclk:ptp=IEEE802.1AS-2011:traceable',
    'a=ts-refclk:gps',
    'a=ts-refclk:gal',
    'a=ts-refclk:glonass',
    'a=ts-refclk:local',
    'a=ts-refclk:private',
    'a=ts-refclk:private:traceable'
  ]) {
    t.same(messages(refclk), [], `${refclk} is accepted`);
  }
  for (const refclk of [
    'a=ts-refclk:ntp',
    'a=ts-refclk:gpsx',
    'a=ts-refclk:private:untraceable',
    'a=ts-refclk:sundial=noon',
    'a=ts-refclk:ptp=IEEE1588-2019:39-A7-94-FF-FE-07-CB-D0:37'
  ]) {
    t.equal(messages(refclk).length, 1, `${refclk} is reported`);
  }

  const should = 'should specify \'IEEE1588-2008\'';
  const shouldMessages = refclk => checkST2110(sdp.replace(/a=ts-refclk:[^\r\n]*/, refclk), { ...cliDefaults, should: true })
    .map(error => error.message).join(' ');
  t.ok(shouldMessages('a=ts-refclk:ptp=IEEE802.1AS-2011:39-A7-94-FF-FE-07-CB-D0').includes(should), 'IEEE802.1AS-2011 is reported with --should');
  t.ok(shouldMessages('a=ts-refclk:ptp=IEEE1588-2002:39-A7-94-FF-FE-07-CB-D0').includes(should), 'IEEE1588-2002 is reported with --should');
  t.notOk(shouldMessages('a=ts-refclk:ptp=IEEE1588-2008:39-A7-94-FF-FE-07-CB-D0:37').includes(should), 'IEEE1588-2008 is not reported with --should');
  t.end();
});

test('ST 2110-10:2022 Section 8.7 tests check TSDELAY is an integer number of microseconds', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const messages = tsdelay => checkST2110(sdp.replace('SSN=ST2110-20:2017;', `SSN=ST2110-20:2017; TSMODE=SAMP; ${tsdelay};`), cliDefaults)
    .map(error => error.message).join(' ');
  const message = 'format parameter \'TSDELAY\'';

  t.notOk(messages('TSDELAY=250').includes(message), 'TSDELAY=250 is accepted');
  // ST 2110-10:2022 Annex B uses TSDELAY=0
  t.notOk(messages('TSDELAY=0').includes(message), 'TSDELAY=0 is accepted');
  t.ok(messages('TSDELAY=-3').includes(message), 'a negative TSDELAY is reported');
  t.ok(messages('TSDELAY=1.5').includes(message), 'a fractional TSDELAY is reported');
  t.ok(messages('TSDELAY').includes(message), 'a TSDELAY with no value is reported');
  t.end();
});

test('ts-refclk and source-filter attributes must match a pattern to the end of the line', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const cases = [
    ['a=ts-refclk:ptp=IEEE1588-2008:nottraceablex', 'is not an acceptable pattern'],
    ['a=ts-refclk:ptp=IEEE1588-2008:junk39-A7-94-FF-FE-07-CB-D0:37', 'is not an acceptable pattern'],
    ['a=ts-refclk:localmac=7C-E9-D3-1B-9A-AFjunk', 'shall specify a MAC address of the form'],
    ['a=source-filter: incl IN IP4 232.80.177.113 172.29.80.65  172.29.80.66', 'Attribute \'source-filter\' is not an acceptable pattern']
  ];

  for (const [attribute, message] of cases) {
    const name = attribute.split(':')[0];
    const variant = sdp.replace(new RegExp(`${name}:[^\\r\\n]*`), attribute);
    const messages = runAllChecks(variant).map(error => error.message).join(' ');
    t.ok(messages.includes(message), `'${attribute}' is reported`);
  }
  t.end();
});

test('RFC 4566 Section 5.7 tests recognise multicast addresses in IPv4 and IPv6 notation', t => {
  const sdp = readFixture('valid/st2110-30.sdp');
  const cases = [
    ['232.130.55.188/32', true],
    ['ff3e::8000:1', true],
    ['FF3E::8000:1', true],
    ['ff3e:0:0:0:0:0:8000:1', true],
    ['ff05:1::1', true],
    ['192.0.2.1', false],
    ['2001:db8::1', false],
    ['2001:db8:0:ff05::1', false]
  ];

  for (const [address, isMulticast] of cases) {
    const addressType = address.includes(':') ? 'IP6' : 'IP4';
    const errors = checkRFC4566(sdp.replace(/c=IN IP4 \S+/, `c=IN ${addressType} ${address}`), { ...cliDefaults, multicast: true });
    t.equal(
      errors.some(error => error.message.includes('must be a multicast address')),
      !isMulticast,
      `${address} is recognised as ${isMulticast ? 'multicast' : 'unicast'}`
    );
  }

  t.end();
});

test('RFC 4566 Section 5.7 tests recognise IPv6 addresses', t => {
  const sdp = readFixture('valid/st2110-30.sdp');
  const cases = [
    ['ff3e::8000:1', true],
    ['FF3E::8000:1', true],
    ['ff3e:0:0:0:0:0:8000:1', true],
    ['ff05:1::1', true],
    ['2001:db8:0:ff05::1', true],
    ['::ffff:192.0.2.1', true],
    ['192.0.2.1', false],
    ['ff3e::8000::1', false],
    ['ff3e:::1', false],
    ['ff3e:12345::1', false],
    ['ff3g::1', false]
  ];

  for (const [address, isIP6] of cases) {
    const errors = checkRFC4566(sdp.replace(/c=IN IP4 \S+/, `c=IN IP6 ${address}`), { ...cliDefaults, useIP6: true });
    t.equal(
      errors.some(error => error.message.includes(`address '${address}' must be an IPv6 address`)),
      !isIP6,
      `${address} is ${isIP6 ? '' : 'not '}recognised as IPv6`
    );
  }
  t.end();
});

test('ST 2110-10:2022 Section 8.4 tests check each multicast stream has an inclusive source filter', t => {
  const sdp = readFixture('valid/st2110-30.sdp');
  const sourceFilter = 'a=source-filter: incl IN IP4 232.130.55.188 172.29.80.65\r\n';
  const noSourceFilter = sdp.replace(sourceFilter, '');
  const ssmMessage = 'For stream 1, destination address \'232.130.55.188\' is in the source-specific multicast range';
  const messages = (variant, params = {}) => runAllChecks(variant, { ...cliDefaults, ...params }).map(error => error.message).join(' ');

  t.ok(messages(noSourceFilter).includes(ssmMessage), 'a source-specific multicast stream without a source filter is reported');
  t.ok(
    messages(noSourceFilter.replace(/(c=[^\r\n]*\r\n)/, '$1a=source-filter: excl IN IP4 232.130.55.188 172.29.80.65\r\n')).includes(ssmMessage),
    'an exclusive source filter is not enough'
  );
  const connection = 'c=IN IP4 232.130.55.188/32\r\n';
  t.same(
    messages(noSourceFilter.replace(connection, '').replace('t=0 0\r\n', connection + 't=0 0\r\n' + sourceFilter)),
    '',
    'a session-level source filter applies to the stream'
  );
  t.ok(
    messages(noSourceFilter.replace(connection, connection + 'a=source-filter: excl IN IP4 232.130.55.188 172.29.80.65\r\n').replace('t=0 0\r\n', 't=0 0\r\n' + sourceFilter)).includes(ssmMessage),
    'a media-level source filter replaces the session-level source filter'
  );

  const ipv6 = sdp.replace(/c=IN IP4 \S+/, 'c=IN IP6 ff3e::8000:1').replace(/a=source-filter:[^\r\n]*/, 'a=source-filter: incl IN IP6 ff3e::8000:1 2001:db8::1');
  t.same(messages(ipv6), '', 'an IPv6 source-specific multicast stream with a source filter passes');
  t.ok(
    messages(ipv6.replace(/a=source-filter:[^\r\n]*\r\n/, '')).includes('For stream 1, destination address \'ff3e::8000:1\' is in the source-specific multicast range'),
    'an IPv6 source-specific multicast stream without a source filter is reported'
  );
  t.notOk(
    messages(ipv6.replace('c=IN IP6 ff3e::8000:1', 'c=IN IP6 FF3E::8000:1')).includes('is in the source-specific multicast range'),
    'a source filter matches a destination address in a different case'
  );
  t.notOk(
    messages(ipv6.replace('c=IN IP6 ff3e::8000:1', 'c=IN IP6 ff3e:0:0:0:0:0:8000:1')).includes('is in the source-specific multicast range'),
    'a source filter matches a destination address written in another form'
  );

  const asm = noSourceFilter.replace('c=IN IP4 232.', 'c=IN IP4 239.');
  t.same(messages(asm), '', 'another multicast stream without a source filter passes by default');
  t.ok(
    messages(asm, { should: true }).includes('For stream 1, destination address \'239.130.55.188\' is multicast, so an inclusive \'source-filter\' attribute should be included'),
    'another multicast stream without a source filter is reported with --should'
  );

  const secondStreamFilter = 'a=source-filter: incl IN IP4 233.252.0.2 198.51.100.1\r\n';
  const duplicate = readFixture('valid/rfc7104_sep_dest.sdp').replace(secondStreamFilter, '');
  const duplicateMessages = messages(duplicate, { should: true });
  t.ok(duplicateMessages.includes('For stream 2, destination address \'233.252.0.2\''), 'a second stream without a source filter is reported');
  t.notOk(duplicateMessages.includes('For stream 1,'), 'the first stream with a source filter passes');
  t.end();
});

test('RFC 4570 Section 3 tests check source filters match a connection address', t => {
  const sdp = readFixture('valid/st2110-30.sdp');
  const sourceFilter = 'a=source-filter: incl IN IP4 232.130.55.188 172.29.80.65\r\n';
  const sessionLevel = sdp.replace(sourceFilter, '').replace('t=0 0\r\n', 't=0 0\r\n' + sourceFilter);
  const message = 'Source filter destination addresses must match one or more connection addresses';
  const messages = variant => checkRFC4570(variant, cliDefaults).map(error => error.message).join(' ');

  t.same(messages(sessionLevel), '', 'a session-level source filter can match a media-level connection address');
  t.ok(
    messages(sessionLevel.replace('232.130.55.188 172', '232.130.55.189 172')).includes(message),
    'a session-level source filter that matches no connection address is reported'
  );
  t.same(
    messages(sdp.replace(/c=IN IP4 \S+/, 'c=IN IP6 FF3E::8000:1').replace(/a=source-filter:[^\r\n]*/, 'a=source-filter: incl IN IP6 ff3e::8000:1 2001:db8::1')),
    '',
    'a source filter matches a connection address in a different case'
  );
  t.same(
    messages(sdp.replace(/c=IN IP4 \S+/, 'c=IN IP6 ff3e:0:0:0:0:0:8000:1').replace(/a=source-filter:[^\r\n]*/, 'a=source-filter: incl IN IP6 ff3e::8000:1 2001:db8::1')),
    '',
    'a source filter matches a connection address written in another form'
  );
  t.same(
    messages(sdp.replace(/c=IN IP4 \S+/, 'c=IN IP4 Example.com').replace(/a=source-filter:[^\r\n]*/, 'a=source-filter: incl IN IP4 example.com 172.29.80.65')),
    '',
    'a source filter matches a connection address domain name in a different case'
  );
  t.end();
});

test('ST 2110-22 Section 7.4 tests report fmtp errors', t => {
  const sdp = readFixture('valid/st2110-22.sdp').replace('a=fmtp:112 ', 'a=fmtp:112 ;');
  const errors = section_22_74(sdp, cliDefaults);

  t.ok(errors.length > 0, 'a malformed fmtp is reported');
  t.ok(errors.every(error => error instanceof Error), 'every result is an Error');
  t.end();
});

test('BT.2100 signals without RANGE are reported only with --should', t => {
  const cases = [
    [readFixture('valid/st2110-20.sdp').replace('colorimetry=BT709', 'colorimetry=BT2100'), 'ST 2110-20 Section 7.5'],
    [readFixture('invalid/st2110-22-range.sdp').replace('RANGE=FULLPROTECT; ', ''), 'RFC 9134 Section 7.1']
  ];
  const message = 'format parameter \'RANGE\' should be specified when \'colorimetry\' is \'BT2100\', as per';

  for (const [sdp, specification] of cases) {
    t.same(checkST2110(sdp, cliDefaults), [], `${specification} is skipped by default`);
    const messages = checkST2110(sdp, { ...cliDefaults, should: true }).map(error => error.message);
    t.ok(messages.some(m => m.includes(`${message} ${specification}.`)), `${specification} is reported with --should`);
  }
  t.end();
});

test('SMPTE channel orders must match the grouping symbols to the end of the value', t => {
  const cases = [
    [readFixture('valid/st2110-30.sdp').replace('a=rtpmap:102 L24/48000/2', '$&\r\na=fmtp:102 channel-order=SMPTE2110.(ST)'), 'SMPTE2110.(ST)'],
    [readFixture('valid/st2110-31-aes3.sdp'), 'SMPTE2110.(AES3,ST)']
  ];
  for (const [sdp, order] of cases) {
    t.same(runAllChecks(sdp), [], `'${order}' is accepted`);
    const messages = runAllChecks(sdp.replace(order, `${order}junk`)).map(error => error.message).join(' ');
    t.ok(messages.includes('format parameter \'channel-order\' is not an acceptable pattern'), `'${order}junk' is reported`);
  }
  t.end();
});

test('ST 2022-8 Section 7.1 tests check TROFF only when shaping', t => {
  t.same(section_2022_8_71(readFixture('invalid/st2022-8-troff.sdp'), { ...cliDefaults, shaping: false }), [], 'a negative TROFF is not reported');
  t.end();
});

test('ST 2110-40:2023 Section 7 tests check TROFF only when shaping', t => {
  const sdp = readFixture('valid/st2110-40-2023.sdp').replace('SSN=ST2110-40:2023', 'SSN=ST2110-40:2023; TROFF=-1');
  const message = 'format parameter \'TROFF\'';

  t.ok(section_40_2023_7(sdp, cliDefaults).some(error => error.message.includes(message)), 'a negative TROFF is reported by default');
  t.notOk(section_40_2023_7(sdp, { ...cliDefaults, shaping: false }).some(error => error.message.includes(message)), 'a negative TROFF is not reported with --no-shaping');
  t.end();
});

test('ST 2110-40:2023 Section 7 tests report SSN ST2110-40:2021 only with --should', t => {
  const sdp = readFixture('valid/st2110-40-2023.sdp').replace('SSN=ST2110-40:2023', 'SSN=ST2110-40:2021');
  const message = 'should be \'ST2110-40:2023\' rather than the equivalent \'ST2110-40:2021\'';

  t.same(section_40_2023_7(sdp, cliDefaults), [], 'SSN=ST2110-40:2021 passes by default');
  t.ok(
    section_40_2023_7(sdp, { ...cliDefaults, should: true }).some(error => error.message.includes(message)),
    'SSN=ST2110-40:2021 is reported with --should'
  );
  t.end();
});

test('RFC 8331 Section 4 tests check VPID_Code is no more than 255', t => {
  const sdp = readFixture('valid/st2110-40-rfc8331.sdp');
  const message = 'format parameter \'VPID_Code\' must be an integer in the range 0 to 255 inclusive';
  const messages = vpid => section_8331_4(sdp.replace('VPID_Code=132', `VPID_Code=${vpid}`), cliDefaults).map(error => error.message).join(' ');

  t.notOk(messages(255).includes(message), 'VPID_Code=255 is accepted');
  t.ok(messages(256).includes(message), 'VPID_Code=256 is reported');
  t.end();
});

test('ST 2110-10 Section 8.2 tests check each media description has a ts-refclk attribute', t => {
  const message = 'the media description shall have a \'ts-refclk\' attribute';
  const messages = sdp => checkST2110(sdp, cliDefaults).map(error => error.message).join(' ');

  const refclk = 'a=ts-refclk:localmac=40-a3-6b-a0-2b-d2\r\n';
  const pair = readFixture('valid/st2110-22.sdp');
  const secondStreamMessages = messages(pair.slice(0, pair.lastIndexOf(refclk)) + pair.slice(pair.lastIndexOf(refclk) + refclk.length));
  t.ok(secondStreamMessages.includes(`Line 15: For stream 2, ${message}`), 'a second stream without a ts-refclk is reported');
  t.notOk(secondStreamMessages.includes(`For stream 1, ${message}`), 'the first stream with a ts-refclk passes');

  const single = readFixture('valid/st2110-20.sdp');
  const mediaRefclk = 'a=ts-refclk:ptp=IEEE1588-2008:EC-46-70-FF-FE-00-CE-DE:0\r\n';
  // RFC 7273 allows a session-level ts-refclk, but ST 2110-10 Section 8.2 requires one in every stream description
  t.ok(
    messages(single.replace(mediaRefclk, '').replace('t=0 0\r\n', 't=0 0\r\n' + mediaRefclk)).includes(`Line 6: For stream 1, ${message}`),
    'a session-level ts-refclk is not enough'
  );
  t.end();
});

test('a missing attribute, field or format parameter is reported at the media description of its stream', t => {
  const messages = (sdp, params = {}) => runAllChecks(sdp, { ...cliDefaults, ...params }).map(error => error.message).join(' ');
  const pair = readFixture('valid/st2110-22.sdp');

  t.ok(messages(readFixture('invalid/st2110-22-missing-fmtp.sdp')).includes('Line 6: For stream 1, an \'fmtp\' attribute shall be specified'),
    'a missing fmtp in the first of two streams');
  t.ok(messages(readFixture('invalid/bad-line-format.sdp')).includes('Line 6: For stream 1, an \'fmtp\' attribute shall be specified'),
    'a missing fmtp in the last stream');
  t.ok(messages(readFixture('invalid/bad-line-format.sdp')).includes('Line 6: For stream 1, format parameter \'TP\' shall be specified'),
    'a missing format parameter of a stream with no fmtp');
  t.ok(messages(pair.replace('c=IN IP4 224.1.1.1/64\r\n', '')).includes('Line 6: For stream 1, a connection data field (\'c=\') must be present'),
    'a missing connection data field in the first of two streams');
  t.ok(messages(pair.replace('c=IN IP4 224.101.1.1/64\r\n', '')).includes('Line 15: For stream 2, a connection data field (\'c=\') must be present'),
    'a missing connection data field in the last stream');
  t.ok(messages(readFixture('invalid/st2110-31-missing-ptime.sdp')).includes('Line 5: For stream 1, attribute \'ptime\' shall be specified'),
    'a missing ptime');
  t.ok(messages(readFixture('valid/st2110-30.sdp'), { channelOrder: true }).includes('Line 5: For stream 1, format parameter \'channel-order\' must be specified'),
    'a missing channel-order');
  t.end();
});

test('RFC 4566 Section 5.7 tests check the TTL of IPv4 multicast connection data fields', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const messages = ttl => checkRFC4566(sdp.replace('c=IN IP4 232.80.177.113/32', `c=IN IP4 232.80.177.113${ttl}`), cliDefaults).map(error => error.message).join(' ');
  const missing = 'with an IPv4 multicast address must have a TTL value';
  const range = 'Multicast TTL value must be an integer in the range 0 to 255 inclusive';

  t.ok(messages('').includes(missing), 'a missing TTL is reported');
  t.ok(messages('/256').includes(range), 'a TTL of 256 is reported');
  t.ok(messages('/064').includes(range), 'a TTL with a leading zero is reported');
  t.same(messages('/255'), '', 'a TTL of 255 is accepted');
  t.same(messages('/0'), '', 'a TTL of 0 is accepted');
  t.end();
});

test('tests that do not apply, or need an option, report that they are skipped in verbose mode', t => {
  const logged = (sdp, params) => {
    const lines = [];
    const log = console.log;
    console.log = line => lines.push(line);
    try {
      runAllChecks(sdp, { ...cliDefaults, ...params, verbose: true });
    } finally {
      console.log = log;
    }
    return lines;
  };
  const raw = readFixture('valid/st2110-20.sdp');
  const jxsv = readFixture('valid/st2110-22.sdp');

  const lines = logged(raw, {});
  t.ok(lines.includes('Test Skipped: ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5] Test 2 - Duplicate streams with separate source addresses are grouped, as per RFC 7104 Section 4.1. No \'a=ssrc-group\' attribute is present.'));
  t.ok(lines.includes('Test Skipped: ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5] Test 3 - Duplicate streams with separate destination addresses are grouped, as per RFC 7104 Section 4.2. No \'a=group\' attribute is present.'));
  t.ok(lines.includes('Test Passed: ST 2110-10 Annex B Test 1 - The SDP file is not a copy of the example.'));
  t.ok(lines.includes('Test Passed: ST 2110-10:2022 Annex B Test 1 - The SDP file is not a copy of the example.'));
  t.ok(lines.includes('Test Passed: ST 2110-10 Section 8.1 Test 4 - The SDP file includes at least one media description.'));
  t.ok(logged(jxsv, {}).includes('Test Passed: VSF TR-08:2022 Appendix A Test 1 - The SDP file is not a copy of the example.'));
  t.ok(lines.includes('Test Passed: SDPoker Test 1 - The SDP file describes a single essence.'));
  t.ok(logged(raw.replace('depth=10', 'depth=10; depth=10'), {}).includes('Test Passed: ST 2110-10:2022 Section 8.7 Test 1 - Format parameters \'TSMODE\' and \'TSDELAY\' are acceptable values.'),
    'a repeated format parameter other than TSMODE or TSDELAY does not remove the TSMODE and TSDELAY pass line');

  const withoutOptions = logged(raw, { noCopy: false, noMedia: false });
  t.ok(withoutOptions.includes('Test Skipped: ST 2110-10 Annex B Test 1 - The SDP file is not a copy of the example. Use --noCopy to test.'));
  t.ok(withoutOptions.includes('Test Skipped: ST 2110-10:2022 Annex B Test 1 - The SDP file is not a copy of the example. Use --noCopy to test.'));
  t.ok(withoutOptions.includes('Test Skipped: ST 2110-10 Section 8.1 Test 4 - The SDP file includes at least one media description. Use --noMedia to test.'));
  t.ok(logged(jxsv, { noCopy: false }).includes('Test Skipped: VSF TR-08:2022 Appendix A Test 1 - The SDP file is not a copy of the example. Use --noCopy to test.'));
  t.end();
});

test('RFC 4566 and RFC 4570 tests report each passed or skipped test in verbose mode', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const logged = (variant, params) => {
    const lines = [];
    const log = console.log;
    console.log = line => lines.push(line);
    try {
      checkRFC4566(variant, { ...cliDefaults, ...params, verbose: true });
      checkRFC4570(variant, { ...cliDefaults, ...params, verbose: true });
    } finally {
      console.log = log;
    }
    return lines;
  };

  const passed = line => line.startsWith('Test Passed: RFC 4');
  const lines = logged(sdp, {});
  t.equal(lines.length, 17, 'one line for each test');
  t.same(lines.filter(line => line.startsWith('Test Skipped')).map(line => line.split(' - ')[0]), [
    'Test Skipped: RFC 4566 Section 5 Test 1',
    'Test Skipped: RFC 4566 Section 5.2 Test 2',
    'Test Skipped: RFC 4566 Section 5.7 Test 3'
  ], 'tests that need an option are skipped without it');
  t.ok(lines.filter(line => !line.startsWith('Test Skipped')).every(passed),
    'the other tests pass');

  const withOptions = logged(sdp, { checkEndings: true, useIP4: true, multicast: true });
  t.equal(withOptions.length, 17, 'one line for each test with the options set');
  t.ok(withOptions.every(passed), 'every test passes with the options set');

  const lfLines = logged(sdp.replace(/\r\n/g, '\n'), { checkEndings: true });
  t.notOk(lfLines.some(line => line.startsWith('Test Passed: RFC 4566 Section 5 Test 1 ')),
    'a test that reports an error does not report that it passed');
  t.end();
});

test('a repeated format parameter is reported once for every stream format', t => {
  for (const fixture of ['st2110-20', 'st2110-22', 'st2110-40-2023']) {
    const sdp = readFixture(`valid/${fixture}.sdp`).replace(/(a=fmtp:\d+ )/, '$1TSMODE=SAMP; TSMODE=SAMP; ');
    const repeats = runAllChecks(sdp).map(error => error.message).filter(m => m.includes('format parameter \'TSMODE\' is specified more than once'));
    t.equal(repeats.length, 1, `${fixture} reports a repeated format parameter once`);
  }
  t.end();
});

test('the ST 2110 checks, not the RFC 4566 checks, report an SDP file with no media description', t => {
  const sdp = readFixture('invalid/missing-media.sdp');
  const message = 'shall include at least one media description';
  t.notOk(checkRFC4566(sdp, cliDefaults).some(error => error.message.includes(message)), 'not reported by the RFC 4566 checks');
  t.ok(checkST2110(sdp, cliDefaults).some(error => error.message.includes(message)), 'reported by the ST 2110 checks');
  t.end();
});

test('library callers that do not set noCopy or noMedia get those checks', t => {
  const copy = readFixture('invalid/st2110-10-annex-b.sdp').replace(/source-filter: incl/g, 'source-filter:incl');
  t.ok(checkST2110(copy, {}).some(error => error.message.includes('must not be a copy of the example')),
    'a copy of the example is reported');
  t.ok(checkST2110(readFixture('invalid/missing-media.sdp'), {}).some(error => error.message.includes('shall include at least one media description')),
    'an SDP file with no media description is reported');
  t.same(checkST2110(copy, { noCopy: false }).filter(error => error.message.includes('must not be a copy')), [],
    'noCopy: false skips the copy check');
  t.end();
});

test('midLast reports media descriptions that do not end with a=mid', t => {
  const params = { ...cliDefaults, midLast: true };
  const errors = runAllChecks(readFixture('valid/rfc7104_sep_dest.sdp'), params);
  t.equal(errors.length, 2, 'one error for each media description');
  t.ok(errors.every(error => error.message.includes('SMPTE RP 2110-23')),
    'errors mention SMPTE RP 2110-23');

  t.same(runAllChecks(readFixture('valid/rfc7104_sep_dest_mid_last.sdp'), params), [],
    'passes when each media description ends with a=mid');

  t.same(runAllChecks(readFixture('valid/st2110-20.sdp'), params), [],
    'is skipped when no a=mid is present');
  t.end();
});

test('line numbers count blank lines, with CRLF, CR or LF line endings', t => {
  const params = { ...cliDefaults, midLast: true };
  const sdp = readFixture('valid/rfc7104_sep_dest.sdp');
  const messages = variant => runAllChecks(variant, params).map(error => error.message);
  const expected = messages(sdp).map(message => message.replace(/^Line (\d+)/, (_, line) => `Line ${+line + 1}`));
  t.ok(expected.length > 0 && expected.every(message => message.startsWith('Line ')), 'the errors give a line');
  for (const [name, ending] of [['CRLF', '\r\n'], ['CR', '\r'], ['LF', '\n']]) {
    const variant = sdp.replace(/\r\n/g, ending).replace(ending, ending + ending);
    t.same(messages(variant), ['Line 2: An SDP file must not contain blank lines, as per RFC 4566 Section 5.', ...expected], name);
  }
  t.end();
});

test('blank lines are reported once, at the first blank line, and no other check reports them', t => {
  const blank = line => `Line ${line}: An SDP file must not contain blank lines, as per RFC 4566 Section 5.`;
  const messages = (sdp, params = {}) => runAllChecks(sdp, { ...cliDefaults, ...params }).map(error => error.message);
  for (const fileName of validFixtures) {
    t.same(messages(readFixture(path.join('valid', fileName)).replace(/\r\n/g, '\r\n\r\n')), [blank(2)], fileName);
  }
  const midLast = readFixture('valid/rfc7104_sep_dest_mid_last.sdp');
  t.same(messages(midLast.replace(/\r\n/g, '\r\n\r\n'), { midLast: true }), [blank(2)], 'with midLast');
  t.same(messages('\r\n' + midLast), [blank(1)], 'a blank first line');
  const copy = readFixture('invalid/st2110-10-annex-b.sdp').replace(/\r\n/g, '\r\n\r\n');
  t.ok(messages(copy).some(message => message.includes('must not be a copy of the example')), 'a copy of the example');
  t.end();
});

test('the line ending errors give the line', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const messages = (variant, params = {}) => checkRFC4566(variant, { ...cliDefaults, ...params }).map(error => error.message);
  const lastLine = sdp.split('\r\n').length - 1;
  t.same(messages(sdp.slice(0, -2)),
    [`Line ${lastLine}: The last record of an SDP file must end with a newline character, as per RFC 4566 Section 5.`], 'no newline at the end');
  const crlf = 'Every record of an SDP file must end with CRLF (0x0d0a), and CR and LF must not appear separately, as per RFC 4566 Section 5.';
  const third = ending => sdp.replace(/^((?:[^\r\n]*\r\n){2}[^\r\n]*)\r\n/, `$1${ending}`);
  t.same(messages(third('\n'), { checkEndings: true }), [`Line 3: ${crlf}`], 'LF at the end of line 3');
  t.same(messages(third('\r'), { checkEndings: true }), [`Line 3: ${crlf}`], 'CR at the end of line 3');
  t.same(messages(sdp.replace(/\r\n/g, '\n'), { checkEndings: true }), [`Line 1: ${crlf}`], 'LF at the end of every line');
  t.end();
});

test('a missing line of a required type is reported where it belongs', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const without = type => sdp.split('\r\n').filter(line => !line.startsWith(`${type}=`)).join('\r\n');
  const missing = (variant, type) => checkRFC4566(variant, cliDefaults).map(error => error.message)
    .filter(message => message.includes(`at least one line of type '${type}'`));
  const message = (line, type) => `Line ${line}: An SDP file must have at least one line of type '${type}', as per RFC 4566 Section 5.`;
  t.same(missing(without('v'), 'v'), [message(1, 'v')], 'v');
  t.same(missing(without('o'), 'o'), [message(2, 'o')], 'o');
  t.same(missing(without('s'), 's'), [message(3, 's')], 's');
  t.same(missing(without('t'), 't'), [message(4, 't')], 't');
  t.same(missing('v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=x\r\n', 't'), [message(3, 't')], 'at the last line when no line comes after it');
  t.end();
});

test('a missing media description is reported at the last line', t => {
  const sdp = readFixture('invalid/missing-media.sdp');
  const message = line => `Line ${line}: An SDP file shall include at least one media description ('m='), as per ST 2110-10 Section 8.1.`;
  const messages = variant => checkST2110(variant, cliDefaults).map(error => error.message);
  t.ok(messages(sdp).includes(message(4)), 'the last line');
  t.ok(messages('\r\n' + sdp).includes(message(5)), 'counting a blank first line');
  t.end();
});

test('a missing duplicate stream group is reported at the first media description', t => {
  const message = line => `Line ${line}: Duplicate RTP streams, as requested by --duplicate, shall be signalled with a session-level 'group:DUP' attribute, as per ST 2110-10 Section 8.3 [also ST 2110-10:2022 Section 8.5].`;
  const messages = file => checkST2110(readFixture(file), { ...cliDefaults, duplicate: true }).map(error => error.message);
  t.ok(messages('valid/st2110-20.sdp').includes(message(5)), 'the first media description');
  t.ok(messages('invalid/missing-media.sdp').includes(message(4)), 'the last line when there is no media description');
  t.end();
});

test('a line out of order is reported once, and the lines after it are checked from that line', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const without = type => sdp.split('\r\n').filter(line => !line.startsWith(`${type}=`)).join('\r\n');
  const order = variant => checkRFC4566(variant, cliDefaults).map(error => error.message)
    .filter(message => message.includes('must not be followed by'));
  t.same(order(without('t')), ['Line 4: A line of type \'s\' must not be followed by a line of type \'m\', as per RFC 4566 Section 5.'], 'no t');
  t.same(order(without('s')), ['Line 3: A line of type \'o\' must not be followed by a line of type \'t\', as per RFC 4566 Section 5.'], 'no s');
  t.end();
});

test('every error that starts with a line number has that line as its line property', t => {
  const files = ['valid', 'invalid'].flatMap(dir => fs.readdirSync(path.join(fixturesRoot, dir))
    .filter(file => file.endsWith('.sdp')).map(file => `${dir}/${file}`));
  const paramSets = [
    cliDefaults,
    { ...cliDefaults, checkEndings: true, should: true, duplicate: true, channelOrder: true, midLast: true, multicast: true, useIP6: true }
  ];
  const errors = files.flatMap(file => paramSets.flatMap(params => runAllChecks(readFixture(file), params)));
  const mismatches = errors.filter(error => {
    const lineMatch = error.message.match(/^Line (\d+): /);
    return error.line !== (lineMatch ? Number(lineMatch[1]) : undefined) || !(error instanceof Error);
  }).map(error => `${error.line}: ${error.message}`);
  t.ok(errors.some(error => error.line !== undefined), 'some errors have a line');
  t.same(mismatches, [], 'the line property matches the message');
  t.end();
});

test('a direct-referenced media clock with no offset is reported when PTP is in use', t => {
  const sdp = readFixture('valid/st2110-20.sdp').replace(/a=mediaclk:direct=0[^\r\n]*/, 'a=mediaclk:direct');
  t.ok(checkST2110(sdp, cliDefaults).some(error => error.message.includes('the \'mediaclk\' attribute shall include a zero offset when direct-referenced PTP timing is in use, as per ST 2110-10 Section 7.4 [also ST 2110-10:2022 Sections 7.3 and 8.3]')),
    'a=mediaclk:direct with no offset is reported');
  t.end();
});

test('a direct-referenced media clock must match the RFC 7273 grammar', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const reported = value => checkST2110(sdp.replace(/a=mediaclk:direct=0[^\r\n]*/, `a=mediaclk:${value}`), cliDefaults)
    .some(error => error.message.includes('attribute \'mediaclk\' is not an acceptable pattern'));
  for (const value of ['direct=0', 'direct', 'direct=0 rate=1000/1001']) {
    t.notOk(reported(value), `'${value}' is accepted`);
  }
  for (const value of ['direct=0 rate=90000', 'direct=0 rate=abc', 'direct=0 rate=0/1001', 'direct=0 rate=01/1', 'direct=abc', 'direct=0rate=1/1']) {
    t.ok(reported(value), `'${value}' is reported`);
  }
  t.end();
});

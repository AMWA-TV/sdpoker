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
  multicast: false, unicast: false, shaping: true, verbose: false
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
    messageIncludes: 'separately from the expected CRLF pattern, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/line-endings-cr.sdp',
    params: { checkEndings: true },
    messageIncludes: 'separately from the expected CRLF pattern, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/line-endings-mixed.sdp',
    params: { checkEndings: true },
    messageIncludes: 'separately from the expected CRLF pattern, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/line-endings-final-cr.sdp',
    params: { checkEndings: true },
    messageIncludes: 'separately from the expected CRLF pattern, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/no-final-line-ending.sdp',
    messageIncludes: 'The last record of an SDP file must end with a newline character, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/blank-line.sdp',
    messageIncludes: 'Blank lines are not permitted, as per RFC 4566 Section 5'
  },
  {
    file: 'invalid/blank-first-line.sdp',
    messageIncludes: 'Blank lines are not permitted, as per RFC 4566 Section 5'
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
    messageIncludes: 'Media description field (\'m=\') is not an acceptable pattern'
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
    file: 'invalid/source-filter-pattern.sdp',
    messageIncludes: 'Attribute \'source-filter\' is not an acceptable pattern'
  },
  {
    file: 'invalid/bad-maxudp.sdp',
    messageIncludes: 'MAXUDP'
  },
  {
    file: 'invalid/missing-media.sdp',
    messageIncludes: 'does not include any media descriptions (\'m=\')'
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
    messageIncludes: 'For stream 1, clock rate shall be 27000000Hz, as per ST 2022-8 Section 5.3'
  },
  {
    file: 'invalid/st2022-8-missing-tp.sdp',
    messageIncludes: 'For stream 1, format parameter \'TP\' shall be specified, as per ST 2022-8 Section 6'
  },
  {
    file: 'invalid/st2022-8-tp.sdp',
    messageIncludes: 'For stream 1, format parameter \'TP\' is not one of \'2110TPNL\' or \'2110TPW\', as per ST 2022-8 Section 6'
  },
  {
    file: 'invalid/st2022-8-dup-missing-tp.sdp',
    params: { shaping: true, duplicate: true },
    messageIncludes: 'Stream 2 requires an \'fmtp\' attribute, as per ST 2022-8 Section 6'
  },
  {
    file: 'invalid/st2022-8-troff.sdp',
    params: { shaping: true },
    messageIncludes: 'For stream 1, format parameter \'TROFF\' cannot be negative, as per ST 2110-21 Section 8.2'
  },
  {
    file: 'invalid/st2110-40-ssn.sdp',
    messageIncludes: 'format parameter \'SSN\' shall be set to \'ST2110-40:2023\' when \'TM\' is present, as per ST 2110-40:2023 Section 7'
  },
  {
    file: 'invalid/st2110-40-clock-rate.sdp',
    messageIncludes: 'For stream 1, clock rate shall be 90000Hz, as per ST 2110-40:2023 Section 5.3'
  },
  {
    file: 'invalid/st2110-40-2018-clock-rate.sdp',
    messageIncludes: 'For stream 1, clock rate shall be 90000Hz, as per ST 2110-40:2023 Section 5.3'
  },
  {
    file: 'invalid/st2110-40-did-sdid.sdp',
    messageIncludes: 'format parameter \'DID_SDID\' value \'{0x141,0x05}\' is not of the form \'{0xNN,0xNN}\', as per RFC 8331 Section 4'
  },
  {
    file: 'invalid/st2110-40-did-sdid-no-value.sdp',
    messageIncludes: 'format parameter \'DID_SDID\' value \'\' is not of the form \'{0xNN,0xNN}\', as per RFC 8331 Section 4'
  },
  {
    file: 'invalid/st2110-40-vpid-code.sdp',
    messageIncludes: 'format parameter \'VPID_Code\' is not an integer from 0 to 255, the value of byte 1 of the VPID, as per RFC 8331 Sections 3.1 and 4'
  },
  {
    file: 'invalid/st2110-40-fmtp-first.sdp',
    messageIncludes: 'format parameter \'TM\' is not set to a required value'
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
    messageIncludes: 'does not match the acceptable audio pattern',
    messageExcludes: 'required attribute \'rtpmap\' is missing'
  },
  {
    file: 'invalid/st2110-31-clock-rate.sdp',
    messageIncludes: 'For stream 1, attribute \'rtpmap\' specifies an unacceptable sampling rate \'32000\', as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-channels.sdp',
    messageIncludes: 'For stream 1, attribute \'rtpmap\' specifies an odd number \'3\' of AES3 subframe sequences, as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-missing-ptime.sdp',
    messageIncludes: 'For stream 1, attribute \'ptime\' shall be specified, as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-ptime.sdp',
    messageIncludes: 'For stream 1, attribute \'ptime\' value \'0.125\' is not permitted for clock rate \'48000\', as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-44100-ptime.sdp',
    messageIncludes: 'For stream 1, attribute \'ptime\' value \'1\' is not permitted for clock rate \'44100\', as per ST 2110-31 Section 6.1'
  },
  {
    file: 'invalid/st2110-31-channel-order.sdp',
    messageIncludes: 'For stream 1, format parameter \'channel-order\' is not acceptable, as per ST 2110-31 Section 6.2'
  },
  {
    file: 'invalid/st2110-43-missing-fmtp.sdp',
    messageIncludes: 'an \'fmtp\' attribute with format parameter \'codecs\' is required'
  },
  {
    file: 'invalid/st2110-43-missing-codecs.sdp',
    messageIncludes: 'format parameter \'codecs\' is required'
  },
  {
    file: 'invalid/st2110-43-fmtp-payload-type.sdp',
    messageIncludes: 'an \'fmtp\' attribute with format parameter \'codecs\' is required'
  },
  {
    file: 'invalid/st2110-43-rtpmap-payload-type.sdp',
    messageIncludes: 'payload type \'113\' of attribute \'rtpmap\'',
    messageExcludes: 'clock rate shall be 90000Hz'
  },
  {
    file: 'invalid/st2110-43-clock-rate.sdp',
    messageIncludes: 'clock rate shall be 90000Hz, as per ST 2110-43'
  },
  {
    file: 'invalid/st2110-43-upper-case-encoding-name.sdp',
    messageIncludes: 'clock rate shall be 90000Hz, as per ST 2110-43'
  },
  {
    file: 'invalid/st2110-22-missing-fmtp.sdp',
    messageIncludes: 'Line 6: For stream 1, the frame rate shall be specified as either an attribute or a parameter of video \'fmtp\''
  },
  {
    file: 'invalid/st2110-22-missing-fmtp.sdp',
    messageIncludes: 'Stream 1 requires an \'fmtp\' attribute'
  },
  {
    file: 'invalid/st2110-22-transmode.sdp',
    messageIncludes: 'format parameter \'transmode\' is not one of \'0\' or \'1\', as per RFC 9134 Section 7.1'
  },
  {
    file: 'invalid/st2110-22-profile-level-sublevel.sdp',
    messageIncludes: 'format parameter \'profile\' is not a JPEG XS profile defined by ISO/IEC 21122-2'
  },
  {
    file: 'invalid/st2110-22-profile-level-sublevel.sdp',
    messageIncludes: 'format parameter \'level\' is not a JPEG XS level defined by ISO/IEC 21122-2'
  },
  {
    file: 'invalid/st2110-22-profile-level-sublevel.sdp',
    messageIncludes: 'format parameter \'sublevel\' is not a JPEG XS sublevel defined by ISO/IEC 21122-2'
  },
  {
    file: 'invalid/st2110-22-depth.sdp',
    messageIncludes: 'format parameter \'depth\' is not a positive integer, as per RFC 9134 Section 7.1'
  },
  {
    file: 'invalid/st2110-22-segmented.sdp',
    messageIncludes: 'format parameter \'segmented\' requires format parameter \'interlace\', as per RFC 9134 Section 7.1'
  },
  {
    file: 'invalid/st2110-22-sampling.sdp',
    messageIncludes: 'format parameter \'sampling\' is not an acceptable value, as per RFC 9134 Section 7.1'
  },
  {
    file: 'invalid/st2110-22-colorimetry.sdp',
    messageIncludes: 'format parameter \'colorimetry\' is not a permitted value, as per RFC 9134 Section 7.1'
  },
  {
    file: 'invalid/st2110-22-tcs.sdp',
    messageIncludes: 'format parameter \'TCS\' (Transfer Characteristic System) is not a permitted value, as per RFC 9134 Section 7.1'
  },
  {
    file: 'invalid/st2110-22-range.sdp',
    messageIncludes: 'not one of the acceptable values for colorimetry BT.2100 of \'FULL\' or \'NARROW\', as per RFC 9134 Section 7.1'
  },
  {
    file: 'invalid/st2110-22-exactframerate.sdp',
    messageIncludes: 'parameter \'exactframerate\' is an integer rate expressed as a non-integer rational, as per ST 2110-22 Section 7.4'
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

test('the ST 2110-10 Annex B example is reported only for its missing TP parameters', t => {
  const messages = runAllChecks(readFixture('invalid/st2110-10-annex-b.sdp')).map(error => error.message);
  t.same(messages, [
    'Line 12: For stream 1, format parameter \'TP\' shall be specified, as per ST 2110-21 Section 8.1.',
    'Line 20: For stream 2, format parameter \'TP\' shall be specified, as per ST 2110-21 Section 8.1.'
  ]);
  t.end();
});

test('a multicast connection address is reported in quotes when unicast is requested', t => {
  const messages = runAllChecks(readFixture('valid/st2110-20.sdp'), { ...cliDefaults, unicast: true }).map(error => error.message);
  t.ok(messages.includes('Line 6: Unicast connections requested by configuration and connection data field address \'232.80.177.113\' is multicast.'));
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

test('ts-refclk and source-filter attributes must match a pattern to the end of the line', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const cases = [
    ['a=ts-refclk:ptp=IEEE1588-2008:nottraceablex', 'do not match acceptable patterns'],
    ['a=ts-refclk:ptp=IEEE1588-2008:junk39-A7-94-FF-FE-07-CB-D0:37', 'do not match acceptable patterns'],
    ['a=ts-refclk:localmac=7C-E9-D3-1B-9A-AFjunk', 'has an invalid MAC address'],
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
      errors.some(error => error.message.includes('is unicast')),
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
      errors.some(error => error.message.includes(`connection data field address '${address}' is not`)),
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
  const message = 'format parameter \'colorimetry\' is \'BT2100\' and so format parameter \'RANGE\' should also be specified, as per';

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
    t.ok(messages.includes('format parameter \'channel-order\' is not acceptable'), `'${order}junk' is reported`);
  }
  t.end();
});

test('ST 2022-8 Section 7.1 tests check TROFF only when shaping', t => {
  t.same(section_2022_8_71(readFixture('invalid/st2022-8-troff.sdp'), { ...cliDefaults, shaping: false }), [], 'a negative TROFF is not reported');
  t.end();
});

test('ST 2110-40:2023 Section 7 tests report SSN ST2110-40:2021 only with --should', t => {
  const sdp = readFixture('valid/st2110-40-2023.sdp').replace('SSN=ST2110-40:2023', 'SSN=ST2110-40:2021');
  const message = 'should be set to \'ST2110-40:2023\' rather than the equivalent \'ST2110-40:2021\'';

  t.same(section_40_2023_7(sdp, cliDefaults), [], 'SSN=ST2110-40:2021 passes by default');
  t.ok(
    section_40_2023_7(sdp, { ...cliDefaults, should: true }).some(error => error.message.includes(message)),
    'SSN=ST2110-40:2021 is reported with --should'
  );
  t.end();
});

test('RFC 8331 Section 4 tests check VPID_Code is no more than 255', t => {
  const sdp = readFixture('valid/st2110-40-rfc8331.sdp');
  const message = 'format parameter \'VPID_Code\' is not an integer from 0 to 255';
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

  t.ok(messages(readFixture('invalid/st2110-22-missing-fmtp.sdp')).includes('Line 6: Stream 1 requires an \'fmtp\' attribute'),
    'a missing fmtp in the first of two streams');
  t.ok(messages(readFixture('invalid/bad-line-format.sdp')).includes('Line 6: Stream 1 requires an \'fmtp\' attribute'),
    'a missing fmtp in the last stream');
  t.ok(messages(readFixture('invalid/bad-line-format.sdp')).includes('Line 6: For stream 1, format parameter \'TP\' shall be specified'),
    'a missing format parameter of a stream with no fmtp');
  t.ok(messages(pair.replace('c=IN IP4 224.1.1.1/64\r\n', '')).includes('Line 6: For stream 1, a connection data field (\'c=\') must be present'),
    'a missing connection data field in the first of two streams');
  t.ok(messages(pair.replace('c=IN IP4 224.101.1.1/64\r\n', '')).includes('Line 15: For stream 2, a connection data field (\'c=\') must be present'),
    'a missing connection data field in the last stream');
  t.ok(messages(readFixture('invalid/st2110-31-missing-ptime.sdp')).includes('Line 5: For stream 1, attribute \'ptime\' shall be specified'),
    'a missing ptime');
  t.ok(messages(readFixture('valid/st2110-30.sdp'), { channelOrder: true }).includes('Line 5: For stream 1, channel order for an audio stream is required'),
    'a missing channel-order');
  t.end();
});

test('RFC 4566 Section 5.7 tests check the TTL of IPv4 multicast connection data fields', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const messages = ttl => checkRFC4566(sdp.replace('c=IN IP4 232.80.177.113/32', `c=IN IP4 232.80.177.113${ttl}`), cliDefaults).map(error => error.message).join(' ');
  const missing = 'Connection data fields using multicast addresses must have a TTL field';
  const range = 'Multicast TTL value must be in the range 0-255';

  t.ok(messages('').includes(missing), 'a missing TTL is reported');
  t.ok(messages('/256').includes(range), 'a TTL of 256 is reported');
  t.ok(messages('/064').includes(range), 'a TTL with a leading zero is reported');
  t.same(messages('/255'), '', 'a TTL of 255 is accepted');
  t.same(messages('/0'), '', 'a TTL of 0 is accepted');
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

  const lines = logged(sdp, {});
  t.equal(lines.length, 17, 'one line for each test');
  t.same(lines.filter(line => line.startsWith('Test Skipped')).map(line => line.split(' - ')[0]), [
    'Test Skipped: RFC 4566 Section 5 Test 1',
    'Test Skipped: RFC 4566 Section 5.2 Test 2',
    'Test Skipped: RFC 4566 Section 5.7 Test 3'
  ], 'tests that need an option are skipped without it');
  t.ok(lines.filter(line => !line.startsWith('Test Skipped')).every(line => line.startsWith('Test Passed: RFC 4')),
    'the other tests pass');

  const withOptions = logged(sdp, { checkEndings: true, useIP4: true, multicast: true });
  t.equal(withOptions.length, 17, 'one line for each test with the options set');
  t.ok(withOptions.every(line => line.startsWith('Test Passed: RFC 4')), 'every test passes with the options set');

  const lfLines = logged(sdp.replace(/\r\n/g, '\n'), { checkEndings: true });
  t.notOk(lfLines.some(line => line.startsWith('Test Passed: RFC 4566 Section 5 Test 1 ')),
    'a test that reports an error does not report that it passed');
  t.end();
});

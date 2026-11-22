const fs = require('fs');
const path = require('path');
const test = require('tape');
const { checkRFC4566, checkRFC4570, checkST2110 } = require('../index.js');
const { section_22_74 } = require('../checkST2110.js');

// Mirror sdpoker.js default CLI options so library tests match CLI behaviour.
const cliDefaults = {
  checkEndings: false, should: false, noCopy: true, noMedia: true,
  duplicate: false,
  skipRFC4566: false, skipRFC4570: false, skipST2110: false,
  channelOrder: false, useIP4: false, useIP6: false,
  multicast: false, unicast: false, shaping: false, verbose: false
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
    messageIncludes: 'source-filter'
  },
  {
    file: 'invalid/st2022-6.sdp',
    messageIncludes: 'mediaclk'
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
    messageIncludes: 'Origin field ("o=") is not an acceptable pattern'
  },
  {
    file: 'invalid/connection-pattern.sdp',
    messageIncludes: 'Connection data field ("c=") is not an acceptable pattern'
  },
  {
    file: 'invalid/media-pattern.sdp',
    messageIncludes: 'Media description field ("m=") is not an acceptable pattern'
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
    messageIncludes: 'Timing field ("t=") is not an acceptable pattern'
  },
  {
    file: 'invalid/bandwidth-pattern.sdp',
    messageIncludes: 'Bandwidth field ("b=") is not an acceptable pattern'
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
    messageIncludes: 'does not include any "m=" media attributes'
  },
  {
    file: 'invalid/missing-ts-refclk.sdp',
    messageIncludes: 'ts-refclk'
  },
  {
    file: 'invalid/st2110-20-fmtp-first.sdp',
    messageIncludes: 'required parameter \'SSN\' is missing'
  },
  {
    file: 'invalid/st2110-40-fmtp-first.sdp',
    messageIncludes: 'format parameter \'TM\' is not set to a required value'
  },
  {
    file: 'invalid/rtpmap-payload-type.sdp',
    messageIncludes: 'attribute \'rtpmap\' has payload type \'106\', which is not a format of the media description'
  },
  {
    file: 'invalid/fmtp-payload-type.sdp',
    messageIncludes: 'attribute \'fmtp\' has payload type \'106\', which is not a format of the media description'
  },
  {
    file: 'invalid/missing-rtpmap.sdp',
    messageIncludes: 'dynamic payload type \'105\' has no \'rtpmap\' attribute'
  },
  {
    file: 'invalid/st2110-20-missing-rtpmap.sdp',
    messageIncludes: 'For stream 2, dynamic payload type \'97\' has no \'rtpmap\' attribute',
    messageExcludes: 'does not have an \'rtpmap\' attribute'
  },
  {
    file: 'invalid/st2110-30-missing-rtpmap.sdp',
    messageIncludes: 'dynamic payload type \'102\' has no \'rtpmap\' attribute',
    messageExcludes: 'required attribute \'rtpmap\' is missing'
  },
  {
    file: 'invalid/st2110-30-encoding-name.sdp',
    messageIncludes: 'does not match the acceptable audio pattern',
    messageExcludes: 'required attribute \'rtpmap\' is missing'
  },
  {
    file: 'invalid/st2110-43-missing-fmtp.sdp',
    messageIncludes: 'an \'fmtp\' attribute with format parameter \'codecs\' is required'
  },
  {
    file: 'invalid/st2110-43-missing-codecs.sdp',
    messageIncludes: 'format parameter \'codecs\' is not present'
  },
  {
    file: 'invalid/st2110-43-fmtp-payload-type.sdp',
    messageIncludes: 'an \'fmtp\' attribute with format parameter \'codecs\' is required'
  },
  {
    file: 'invalid/st2110-43-rtpmap-payload-type.sdp',
    messageIncludes: 'attribute \'rtpmap\' has payload type \'113\'',
    messageExcludes: 'clock rate must be 90000Hz'
  },
  {
    file: 'invalid/st2110-43-clock-rate.sdp',
    messageIncludes: 'clock rate must be 90000Hz, as per ST 2110-43'
  },
  {
    file: 'invalid/st2110-43-upper-case-encoding-name.sdp',
    messageIncludes: 'clock rate must be 90000Hz, as per ST 2110-43'
  },
  {
    file: 'invalid/st2110-22-missing-fmtp.sdp',
    messageIncludes: 'Media Stream 1: Framerate must specified as either an attribute or a parameter of video fmtp'
  },
  {
    file: 'invalid/st2110-22-missing-fmtp.sdp',
    messageIncludes: 'Stream 1 does not have an \'fmtp\' attribute'
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
    messageIncludes: 'format parameter \'segmented\' is signalled without \'interlace\' being signalled, as per RFC 9134 Section 7.1'
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
    const errors = runAllChecks(sdp);
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

test('ts-refclk PTP grandmaster identities can use lower-case hex digits', t => {
  const sdp = readFixture('valid/st2110-20.sdp');
  const variant = sdp.replace(/a=ts-refclk:[^\r\n]*/, 'a=ts-refclk:ptp=IEEE1588-2008:39-a7-94-ff-fe-07-cb-d0:37');
  t.same(runAllChecks(variant).map(error => error.message), []);
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
  const message = 'format parameter \'colorimetry\' is \'BT2100\' and so a \'RANGE\' parameter should also be specified, as per';

  for (const [sdp, specification] of cases) {
    t.same(checkST2110(sdp, cliDefaults), [], `${specification} is skipped by default`);
    const messages = checkST2110(sdp, { ...cliDefaults, should: true }).map(error => error.message);
    t.ok(messages.some(m => m.includes(`${message} ${specification}.`)), `${specification} is reported with --should`);
  }
  t.end();
});

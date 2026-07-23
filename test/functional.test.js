const fs = require('fs');
const path = require('path');
const test = require('tape');
const { checkRFC4566, checkRFC4570, checkST2110 } = require('../index.js');

// Mirror sdpoker.js default CLI options so library tests match CLI behaviour.
const cliDefaults = {
  checkEndings: false, should: false, noCopy: true, noMedia: true,
  duplicate: false, videoOnly: false, audioOnly: false,
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
  }
];

test('valid SDP fixtures pass default checks', t => {
  t.plan(validFixtures.length);

  for (const fileName of validFixtures) {
    const sdp = fs.readFileSync(path.join(validFixturesDir, fileName), 'utf8');
    const errors = runAllChecks(sdp);

    t.same(
      errors,
      [],
      `${fileName} passes default checks`
    );
  }
});

test('invalid SDP fixtures are rejected', t => {
  t.plan(invalidCases.length * 2);

  for (const invalidCase of invalidCases) {
    const sdp = readFixture(invalidCase.file);
    const errors = runAllChecks(sdp);
    const messages = errors.map(error => error.message).join(' ');

    t.ok(errors.length > 0, `${invalidCase.file} should fail validation`);
    t.ok(
      messages.includes(invalidCase.messageIncludes),
      `${invalidCase.file} reports an error mentioning "${invalidCase.messageIncludes}"`
    );
  }
});

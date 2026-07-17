const path = require('path');
const { spawnSync } = require('child_process');
const test = require('tape');

const { version: packageVersion } = require('../package.json');

const cliPath = path.join(__dirname, '..', 'sdpoker.js');
const validFixture = path.join(__dirname, 'fixtures', 'valid', 'st2110-20.sdp');

// Spawn the real CLI the same way an external consumer (e.g. nmos-testing) would.
// This exercises sdpoker.js and its yargs argument parsing, which the library
// level tests in functional.test.js never touch.
function runCli(cliArguments) {
  return spawnSync(process.execPath, [cliPath, ...cliArguments], { encoding: 'utf8' });
}

test('CLI --version reports the package version and exits cleanly', t => {
  const result = runCli(['--version']);

  t.equal(result.status, 0, 'sdpoker --version exits with code 0');
  t.ok(
    result.stdout.includes(packageVersion),
    `sdpoker --version prints the package version (${packageVersion})`
  );
  t.notOk(
    /is not a function/.test(result.stderr),
    'sdpoker --version does not throw a yargs initialisation error'
  );
  t.end();
});

test('CLI --help prints usage and exits cleanly', t => {
  const result = runCli(['--help']);

  t.equal(result.status, 0, 'sdpoker --help exits with code 0');
  t.ok(result.stdout.includes('Usage:'), 'sdpoker --help prints usage information');
  t.end();
});

test('CLI validates a valid SDP fixture and exits cleanly', t => {
  const result = runCli([validFixture]);

  t.equal(
    result.status,
    0,
    'sdpoker validates a known-good fixture and exits with code 0'
  );
  t.end();
});

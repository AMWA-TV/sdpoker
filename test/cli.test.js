const fs = require('fs');
const os = require('os');
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

// Regression test for https://github.com/AMWA-TV/sdpoker/issues/75
// yargs locates package.json relative to the project containing its own
// node_modules directory. When sdpoker is installed as a dependency, yargs is
// hoisted into the consumer's node_modules, so --version must not depend on
// that lookup. Simulate an installation into a consumer project whose
// package.json declares a different version.
test('CLI --version reports the sdpoker version when installed as a dependency', t => {
  const repositoryRoot = path.join(__dirname, '..');
  const consumerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdpoker-consumer-'));
  const installedPackageRoot = path.join(consumerRoot, 'node_modules', 'sdpoker');
  const consumerVersion = '9.9.9';

  try {
    fs.writeFileSync(
      path.join(consumerRoot, 'package.json'),
      JSON.stringify({ name: 'consumer', version: consumerVersion })
    );
    fs.cpSync(path.join(repositoryRoot, 'node_modules'), path.join(consumerRoot, 'node_modules'), {
      recursive: true
    });
    fs.mkdirSync(installedPackageRoot, { recursive: true });
    [
      'sdpoker.js', 'index.js', 'checkRFC4566.js', 'checkRFC4570.js',
      'checkST2110.js', 'package.json'
    ].forEach(fileName => {
      fs.copyFileSync(path.join(repositoryRoot, fileName), path.join(installedPackageRoot, fileName));
    });

    const result = spawnSync(
      process.execPath,
      [path.join(installedPackageRoot, 'sdpoker.js'), '--version'],
      { encoding: 'utf8', cwd: consumerRoot }
    );

    t.equal(result.status, 0, 'installed sdpoker --version exits with code 0');
    t.equal(
      result.stdout.trim(),
      packageVersion,
      `installed sdpoker --version prints the sdpoker version (${packageVersion}), not the consumer version or unknown`
    );
  } finally {
    fs.rmSync(consumerRoot, { recursive: true, force: true });
  }
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

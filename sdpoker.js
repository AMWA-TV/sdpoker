#!/usr/bin/env node
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

const { getSDP, checkRFC4566, checkRFC4570, checkST2110 } = require('./index.js');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { accessSync, R_OK } = require('fs');

const args = yargs(hideBin(process.argv))
  .help('help')
  .version(require('./package.json').version)
  .options({
    checkEndings: { type: 'boolean', default: false, describe: 'Check line endings are CRLF, no other CR/LF' },
    should: { type: 'boolean', default: false, describe: 'As well as shall, also check all should clauses' },
    noCopy: { type: 'boolean', default: true, describe: 'Fail obvious copies of the SDP examples in ST 2110-10, ST 2110-10:2022 and VSF TR-08:2022' },
    noMedia: { type: 'boolean', default: true, describe: 'Fail SDP files which do not include any media descriptions' },
    duplicate: { type: 'boolean', default: false, describe: 'Expect duplicate streams aka ST 2022-7' },
    skipRFC4566: { type: 'boolean', default: false, describe: 'Skips RFC 4566 checks' },
    skipRFC4570: { type: 'boolean', default: false, describe: 'Skips RFC 4570 checks' },
    skipST2110: { type: 'boolean', default: false, describe: 'Skips ST 2110 checks' },
    channelOrder: { type: 'boolean', default: false, describe: 'Expect audio with ST 2110-30 channel-order' },
    useIP4: { type: 'boolean', default: false, describe: 'All addresses expressed in IP v4 notation' },
    useIP6: { type: 'boolean', default: false, describe: 'All addresses expressed in IP v6 notation' },
    multicast: { type: 'boolean', default: false, describe: 'Connection addresses must be multicast' },
    unicast: { type: 'boolean', default: false, describe: 'Connection addresses must be unicast' },
    shaping: { type: 'boolean', default: true, describe: 'Check adherence to traffic shaping specification' },
    midLast: { type: 'boolean', default: false, describe: 'Check each media description ends with a=mid, as expected by SMPTE RP 2110-23' },
    verbose: { type: 'boolean', default: false, describe: 'Print passed and skipped tests as well as failed' }
  })
  .usage('Check an SDP file for conformance with RFC 4566 and SMPTE ST 2110.\n' +
    'Usage: $0 [options] <sdp_file or HTTP URL>')
  .check(argv => {
    if (argv._.length < 1) {
      throw new Error('File name or URL for SDP file must be provided.');
    }
    if (!argv._[0].startsWith('http')) {
      accessSync(argv._[0], R_OK);
    }
    if (argv.useIP4 && argv.useIP6) {
      throw new Error('Cannot set both --useIP4 and --useIP6 at the same time.');
    }
    if (argv.multicast && argv.unicast) {
      throw new Error('Cannot set both --multicast and --unicast at the same time.');
    }
    return true;
  })
  .argv;

// console.log(args);

async function test (args) {
  try {
    if(args.skipRFC4566 && args.skipRFC4570 && args.skipST2110)
    {
      console.error('All checks have been skipped.');
      process.exit(1);
    }

    let sdp = await getSDP(args._[0]);

    let errors = [];

    if(!args.skipRFC4566)
      errors = errors.concat(checkRFC4566(sdp, args));
    
    if(!args.skipRFC4570)
      errors = errors.concat(checkRFC4570(sdp, args));

    if(!args.skipST2110)
      errors = errors.concat(checkST2110(sdp, args));

    if (errors.length !== 0) {
      console.error(`Found ${errors.length} error(s) in SDP file:`);
      for ( let c in errors ) {
        console.error(`${+c + 1}: ${errors[c].message}`);
      }
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (e) {
    console.error(e);
  }
}

test(args);

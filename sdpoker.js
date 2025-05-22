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
const { accessSync, R_OK } = require('fs');

const args = yargs
  .help('help')
  .default('checkEndings', false)
  .default('should', false)
  .default('noCopy', true)
  .default('noMedia', true)
  .default('duplicate', false)
  .default('videoOnly', false)
  .default('audioOnly', false)
  .default('skipRFC4566', false)
  .default('skipRFC4570', false)
  .default('skipST2110', false)
  .default('channelOrder', false)
  .default('useIP4', false)
  .default('useIP6', false)
  .default('multicast', false)
  .default('unicast', false)
  .default('shaping', false)
  .default('verbose', false)
  .boolean([ 'checkEndings', 'should', 'noCopy', 'noMedia',
    'duplicate', 'videoOnly', 'audioOnly', 'channelOrder',
    'useIP4', 'useIP6', 'multicast', 'unicast', 'shaping', 'verbose' ])
  .usage('Check an SDP file for conformance with RFC4566 and SMPTE ST 2110.\n' +
    'Usage: $0 [options] <sdp_file or HTTP URL>')
  .describe('checkEndings', 'Check line endings are CRLF, no other CR/LF.')
  .describe('should', 'As well as shall, also check all should clauses.')
  .describe('noCopy', 'Fail obvious copies of the ST 2110-10 SDP example')
  .describe('noMedia', 'Fail SDP files which do not include any media descriptions')
  .describe('duplicate', 'Expect duplicate streams aka ST 2022-7.')
  .describe('videoOnly', 'Describes only SMPTE ST 2110-20 streams.')
  .describe('audioOnly', 'Describes only SMPTE ST 2110-30 streams.')
  .describe('skipRFC4566', 'Skips RFC4566 checks.')
  .describe('skipRFC4570', 'Skips RFC4570 checks.')
  .describe('skipST2110', 'Skips ST2110 checks.')
  .describe('channelOrder', 'Expect audio with ST2110-30 channel-order.')
  .describe('useIP4', 'All addresses expressed in IP v4 notation.')
  .describe('useIP6', 'All addresses expressed in IP v6 notation.')
  .describe('multicast', 'Connection addresses must be multicast.')
  .describe('unicast', 'Connection addresses must be unicast.')
  .describe('shaping', 'Check adherence to traffic shaping specification.')
  .describe('verbose', 'Print passed tests as well as failed.')
  .check(argv => {
    if (argv._.length < 1) {
      throw new Error('File name or URL for SDP file must be provided.');
    }
    if (!argv._[0].startsWith('http')) {
      accessSync(argv._[0], R_OK);
    }
    if (argv.useIP4 && argv.useIP6) {
      throw new Error('Cannot set both useIP4 and useIP6 flags at the same time.');
    }
    if (argv.multicast && argv.unicast) {
      throw new Error('Cannot set both multicast and unicast flags at the same time.');
    }
    if (argv.audioOnly && argv.videoOnly) {
      throw new Error('Cannot set both videoOnly and audioOnly flags at the same time.');
    }
    return true;
  })
  .argv;

// console.log(args);

async function test (args) {
  try {
    if(args.skipRFC4566 && args.skipRFC4570 && args.skipST2110)
    {
      console.error(`All checks have been skipped`);
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

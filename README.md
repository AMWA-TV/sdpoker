# SDPoker

CLI tool and library for testing SMPTE ST 2110 compliant Session Description Protocol (SDP) files. The tool attempts to apply a number of rules that test relevant clauses of [RFC 4566](https://tools.ietf.org/html/rfc4566), ST 2110 and AES-67. The tool currently has 112 possible tests.

Just because an SDP file passes these tests does not mean it is 100% valid. However, if it fails one of the tests, the file is likely to need some work!

This is an open source tool contributed for the benefit of anyone developing and deploying professional IP media systems. Please use pull requests and issues to help to enhance it. Please do report any false positives or false negatives found by these tests. A list of possible [enhancements](#enhancements) is provided below.

SDPoker is part of the [zenmos](https://github.com/Streampunk/zenmos) project to develop an automatic testing tool for AMWAs [Network Media Open Specifications](https://nmos.tv/).

# Important Note

This is a fork of the original repository from [Streampunk/sdpoker](https://github.com/Streampunk/sdpoker) including additional features and bug fixes. It is intended to be used alongside the [NMOS Testing Tool](https://github.com/AMWA-TV/nmos-testing).

# Installation

## Prerequisite

If not already installed, install [Node.JS LTS](https://nodejs.org/) for your platform.

## Command line

Install SDPoker globally as follows (use `sudo` where appropriate):

    npm install -g AMWA-TV/sdpoker

To run SDPoker, append a filename or URL to a SDP file:

    sdpoker <file_or_url>

Note that the tool only prints an output if the tests fail. A successful test returns immediately with nothing printed and an exit code of `0`.

A number of options can be used to configure the behavior of the test. To see the list, run:

    sdpoker --help

## Library

Install SDPoker as a dependency for the project you are working on:

    npm install --save sdpoker

Use the module in your project with the following line:

```javascript
const { getSDP, checkRFC4566, checkRFC4570, checkST2110 } = require('sdpoker');
```

### Get SDP

The `getSDP(path)` method returns a native promise to read or download an SDP file from the given path. If the path starts with `http://`, the SDP file is requested from the given address. Otherwise, the path is treated as a file path related to the current working directory.

For example:

```javascript
getSDP('http://localhost:3123/sdps/video_stream_1.sdp')
  .then(console.log)
  .catch(console.error);
```

The value of a fulfilled promise is the contents of an SDP file as a string. SDP files are assumed to be UTF8 character sets. Pass the result into the `checkRFC4566`, `checkRFC4570` and `checkST2110` methods.

### Check RFC4566

The `checkRFC4566(sdp, params)` takes a string representation of the contents of an SDP file (`sdp`) and runs structural tests, format tests and some field specific tests relevant to ST 2110. This is not an exhaustive SDP file tester.

For example:

```javascript
getSDP('examples/st2110-10.sdp')
  .then(sdp => checkRFC4566(sdp, { should: true }))
  .then(errs => { if (errs.length > 0) console.log(errs); })
  .catch(console.error);
```

The `params` parameter is an object that, when present, can be used to configure the tests. See the [parameters](#parameters) section below for more information.

The return value of the method is an array of [Javascript Errors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error). The array is empty if no errors occurred.

### Check RFC4570

The `checkRFC4570(sdp, params)` takes a string representation of the contents of an SDP file (`sdp`) and runs source-filter tests relevant to SMPTE ST 2110.

For example:

```javascript
getSDP('examples/st2110-10.sdp')
  .then(sdp => checkRFC4570(sdp, {}))
  .then(errs => { if (errs.length > 0) console.log(errs); })
  .catch(console.error);
```

The `params` parameter is an object that, when present, can be used to configure the tests. See the [parameters](#parameters) section below for more information.

The return value of the method is an array of [Javascript Errors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error). The array is empty if no errors occurred.

### Check ST 2110

The `checkST2110(sdp, params)` takes a string representation of the contents of an SDP file (`sdp`) and runs through the relevant clauses of the ST 2110-10/-20/-21/-22/-30 documents, and referenced standards such as AES-67 and ST 2022-7, applying appropriate tests.

For example:

```javascript
getSDP('examples/st2110-10.sdp')
  .then(sdp => checkST2110(sdp, { multicast: true }))
  .then(errs => { if (errs.length > 0)
    console.log(errs.map(e => e ? e.message : undefined));
  })
  .catch(console.error);
```

The `params` parameter is an object that, when present, can be used to configure the tests. See the [parameters](#parameters) section below for more information.

The return value of the method is an array of [Javascript Errors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error). The array is empty if no errors occurred.

### Parameters

The parameters of the library are binary flags that match the command line options:

* `checkEndings`: Check line endings are CRLF, no other CR/LF.
* `whitespace`: Strict check of adherence to whitespace rules.
* `should`: As well as shall, also check all should clauses.
* `noCopy`: Fail obvious copies of the ST 2110-10 SDP example.
* `noMedia`: Fail SDP files which do not include any media descriptions.
* `duplicate`: Expect duplicate streams aka ST 2022-7.
* `videoOnly`: Describes only SMPTE ST 2110-20 streams.
* `audioOnly`: Describes only SMPTE ST 2110-30 streams.
* `channelOrder`: Expect audio with ST2110-30 channel-order.
* `shaping`: Check adherence to traffic shaping specification.
* `useIP4`: All addresses expressed in IP v4 notation.
* `useIP6`: All addresses expressed in IP v6 notation.
* `multicast`: Connection addresses must be multicast.
* `unicast`: Connection addresses must be unicast.
* `verbose`: Print out tests that pass to the console as well as failures.

By default, all flags are `false`. To pass the parameters to the _check_ methods, use a Javascript object as follows:

```javascript
let params = {
  duplicate: true,
  multicast: true
};
```

# Tests

For now, please see the comments in files `checkRFC4566.js`, `checkRFC4570.js` and `checkST2110.js` for a description of the tests. A more formal and separate list may be provided in the future.

# Enhancements

The following items are known deficiencies of SDPoker and may be added in the future:

* Tests for attribute `a=recvonly`
* Testing whether an advertised connection address can be resolved, joined or pinged.
* Testing whether advertised clocks are available.
* Testing that, for AES-67 audio streams, the `ptime` attribute matches the sample rate and number of channels.
* Testing ST 2110-30 audio streams against conformance level.
* Ability to run the tests within a framework like [tape](https://www.npmjs.com/package/tape).
* Retrieval of SDP files over HTTPS.

Pull requests and issues will be resolved when the developers have sufficient time available. If you are interested in sponsoring the development of this software or supporting its ongoing maintenance, please contact [Streampunk Media](https://www.streampunk.media) (furnace@streampunk.media).

# License

This software is released under the Apache 2.0 license. Copyright 2018 Streampunk Media Ltd.

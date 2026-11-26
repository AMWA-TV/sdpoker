# SDPoker

[![CI Status](https://github.com/AMWA-TV/sdpoker/workflows/CI/badge.svg)](https://github.com/AMWA-TV/sdpoker/actions?query=workflow%3ACI)

CLI tool, web application, and library for testing SMPTE ST 2110 compliant Session Description Protocol (SDP) files. The tool attempts to apply a number of rules that test relevant clauses of [RFC 4566](https://tools.ietf.org/html/rfc4566), ST 2110 and AES67. With `--verbose`, it also lists the tests that passed or were skipped.

> [!NOTE]
> Try the SDPoker web application at https://amwa-tv.github.io/sdpoker/. The checks run in your browser, and the SDP is not uploaded. See [Web Application](#web-application).

Just because an SDP file passes these tests does not mean it is 100% valid. However, if it fails one of the tests, the file is likely to need some work!

This is an open source tool contributed for the benefit of anyone developing and deploying professional IP media systems. Please use pull requests and issues to help to enhance it. If SDPoker gives no error for an invalid SDP file, gives an error for a valid one, or gives a wrong or unclear error, [report an incorrect SDP check result](https://github.com/AMWA-TV/sdpoker/issues/new?template=sdp-check-result.yml). A list of possible [enhancements](#enhancements) is provided below.

This is a fork of the original repository from [Streampunk/sdpoker](https://github.com/Streampunk/sdpoker) including additional features and bug fixes. It is intended to be used alongside the [NMOS Testing Tool](https://github.com/AMWA-TV/nmos-testing).

# Recent Activity

Recent activity on the project (newest first):

- Added checks of the VSF TR-10 (IPMX) requirements for the SDP files of IPMX streams, and `--ipmx`, to expect IPMX streams
- Added checks of the level and syntax of the attributes that RFC 3605, RFC 4566, RFC 4570, RFC 5576, RFC 5888, RFC 7197, RFC 7273, RFC 8285 and VSF TR-10-5:2026 define, and of the RFC 8759 `charset` and `profile` format parameters of TTML streams
- The syntax checks of the attributes that the ST 2110 tests also use, such as `rtpmap`, `ptime` and `mediaclk`, and of `source-filter`, are skipped by `--skipRFC4566`, not by `--skipST2110` or `--skipRFC4570`
- Repeated format parameters are reported as per RFC 6838 for every stream, so `--skipRFC4566` skips this check, not `--skipST2110`
- Added checks of media fields (`m=`), and that the format of each `rtpmap` and `fmtp` attribute is a format of its media description, as per RFC 4566
- With `--should`, each media description with more than one format is reported
- Released v0.6.0
- Added `--midLast`, to check that each media description ends with `a=mid`, as expected by SMPTE RP 2110-23
- The traffic shaping checks of ST 2110-21, ST 2022-8 and ST 2110-40 run by default, and `--no-shaping` skips them
- Added checks of the ST 2110-31 parameters of AM824 streams
- Added checks of the ST 2022-8 parameters of ST 2022-6 streams
- Added checks of the ST 2110-40 and RFC 8331 format parameters of ANC data streams
- Added checks of the RFC 9134 format parameters of JPEG XS streams
- Added checks of ST 2110-43 timed text (TTML) streams
- Removed the `--videoOnly` and `--audioOnly` options, because SDPoker now reports any SDP file that describes more than one essence
- v0.5.0 supports Node.js 22.12 or later
- Fixed `sdpoker --version` when SDPoker is installed from the repository
- Added functional and CLI tests, and lint in CI
- SDP files are fetched over HTTP with Node's native `fetch` instead of the deprecated `request` package
- Added width and height checks for ST 2110-22, and MAXUDP checks for every ST 2110 SDP file against the range allowed by ST 2110-10
- Added `--skipRFC4566`, `--skipRFC4570` and `--skipST2110` options to skip each group of checks

# Installation

## Prerequisite

SDPoker supports Node.js 22.12 or later. If not already installed, install [Node.JS LTS](https://nodejs.org/) for your platform.

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

### Check RFC 4566

The `checkRFC4566(sdp, params)` takes a string representation of the contents of an SDP file (`sdp`) and runs structural tests, format tests and some field specific tests relevant to ST 2110. The attribute tests also check the level and syntax of some attributes that other specifications define, and each message cites that specification. However, this is not an exhaustive SDP file tester.

For example:

```javascript
getSDP('examples/st2110-10.sdp')
  .then(sdp => checkRFC4566(sdp, { should: true }))
  .then(errs => { if (errs.length > 0) console.log(errs); })
  .catch(console.error);
```

The `params` parameter is an object that, when present, can be used to configure the tests. See the [parameters](#parameters) section below for more information.

The return value of the method is an array of [Javascript Errors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error). The array is empty if no errors occurred.
An error found at a line of the SDP file has a `line` property with that line number, which also starts its message.

### Check RFC 4570

The `checkRFC4570(sdp, params)` takes a string representation of the contents of an SDP file (`sdp`) and checks that the addresses of each source filter match its address type and a connection address. `checkRFC4566` checks the syntax of the `source-filter` attribute.

For example:

```javascript
getSDP('examples/st2110-10.sdp')
  .then(sdp => checkRFC4570(sdp, {}))
  .then(errs => { if (errs.length > 0) console.log(errs); })
  .catch(console.error);
```

The `params` parameter is an object that, when present, can be used to configure the tests. See the [parameters](#parameters) section below for more information.

The return value of the method is an array of [Javascript Errors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error). The array is empty if no errors occurred.
An error found at a line of the SDP file has a `line` property with that line number, which also starts its message.

### Check ST 2110

The `checkST2110(sdp, params)` takes a string representation of the contents of an SDP file (`sdp`) and runs through the relevant clauses of the ST 2110-10/-20/-21/-22/-30/-31/-40/-43 and ST 2022-8 documents, and referenced standards such as AES67, RFC 8331, RFC 8759, RFC 9134 and ST 2022-7, applying appropriate tests.

`checkST2110` also runs the tests of the VSF TR-10 (IPMX) Technical Recommendations for each stream whose format parameters have the `IPMX` declaration of VSF TR-10-1:2024. With `ipmx`, it runs them for every stream, and reports any stream without the declaration.

The SDP file must describe a single essence, as an ST 2110 sender's SDP file does. It may contain more than one media description only for ST 2022-7 redundant streams, and every media description must have the same media type and encoding name. Otherwise, `checkST2110` reports that and runs no other tests. When the SDP file does describe a single essence, `checkST2110` chooses its tests by the encoding name of the first format of a media description, and with `should`, it also reports each media description with more than one format.

`checkST2110` reads each media field (`m=`) that `checkRFC4566` accepts. When a media field is not an acceptable pattern for RFC 4566, `checkST2110` runs no tests and reports nothing, so run `checkRFC4566` as well.

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
An error found at a line of the SDP file has a `line` property with that line number, which also starts its message.

### Parameters

The parameters of the library are binary flags that match the command line options:

* `checkEndings`: Check line endings are CRLF, no other CR/LF.
* `should`: As well as shall, also check all should clauses.
* `noCopy`: Fail obvious copies of the SDP examples in ST 2110-10, ST 2110-10:2022 and VSF TR-08:2022.
* `noMedia`: Fail SDP files which do not include any media descriptions.
* `duplicate`: Expect duplicate streams aka ST 2022-7.
* `channelOrder`: Expect audio with ST 2110-30 channel-order.
* `shaping`: Check adherence to traffic shaping specification.
* `midLast`: Check each media description ends with a=mid, as expected by SMPTE RP 2110-23.
* `ipmx`: Expect IPMX streams, with the IPMX declaration of VSF TR-10-1:2024.
* `useIP4`: All addresses expressed in IP v4 notation.
* `useIP6`: All addresses expressed in IP v6 notation.
* `multicast`: Connection addresses must be multicast.
* `unicast`: Connection addresses must be unicast.
* `verbose`: Print passed and skipped tests as well as failed.

By default, all flags are `false`, except `noCopy`, `noMedia` and `shaping`, which are `true`. To pass the parameters to the _check_ methods, use a Javascript object as follows:

```javascript
let params = {
  duplicate: true,
  multicast: true
};
```

# Web Application

The `web` directory is a browser application that runs the same checks as the command line tool. SDP can be pasted, typed, opened from a local file, or loaded from the SDP files in `examples` and `test/fixtures`. The checks run in the browser, and the SDP is not uploaded. The GitHub Actions workflow `.github/workflows/pages.yml` publishes the application with GitHub Pages when the `master` branch changes, and when the workflow is run manually, from any branch that the repository's `github-pages` environment allows.

The line-ending check is available only for an unmodified file or example, because pasted, typed or edited SDP does not keep its original line endings.

To develop the application, install Node.js and run:

```
cd web
npm install
npm run dev
```

`npm test` runs the unit tests. `npm run build` builds the static site in `web/dist`. After that, `npm run preview` serves the built site at `http://localhost:4173/`, and `npm run test:e2e` runs the browser tests in Chromium, after `npx playwright install chromium`.

For either `npm run dev` or `npm run preview`, add `-- --port <port>` to use another port, and/or `-- --host` to make the server reachable from other machines.

# Tests

Running `sdpoker` with `--verbose` lists the tests that passed or were skipped, as well as any errors. Please see the comments in files `checkRFC4566.js`, `checkRFC4570.js` and `checkST2110.js` for a description of the tests.

# Enhancements

Contributions via issues and pull requests are welcomed.

The following are some possible enhancements to SDPoker that may be added in the future:

* Tests for attribute `a=recvonly`
* Testing whether an advertised connection address can be resolved, joined or pinged.
* Testing whether advertised clocks are available.
* Testing that, for AES67 audio streams, the `ptime` attribute matches the sample rate and number of channels.
* Testing ST 2110-30 audio streams against conformance level.
* Tests of the IPMX `a=privacy` and `a=infoframe` attributes, and of the `FECPROFILE` format parameter.
* Ability to run the tests within a framework like [tape](https://www.npmjs.com/package/tape).
* Retrieval of SDP files over HTTPS.

# License

This software is released under the Apache 2.0 license. Copyright 2018 Streampunk Media Ltd. Copyright (C) 2019 Advanced Media Workflow Association.

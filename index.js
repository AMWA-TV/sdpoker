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

const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const { allSections : checkRFC4566 } = require('./checkRFC4566.js');
const { allSections : checkRFC4570 } = require('./checkRFC4570.js');
const { allSections : checkST2110 } = require('./checkST2110.js');

const getSDP = (path) => {
  return (path.startsWith('http')) ?
    fetch(path).then(res => {
      if (!res.ok) {
        return Promise.reject(new Error(
          `SDP file request resulted in non-OK response code of ${res.status}.`));
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.startsWith('application/sdp')) {
        return Promise.reject(new Error(
          `Media type (MIME type/Content-Type) of SDP file is '${contentType}' and not signalled as 'applicatio/sdp' as required in RFC 4566 Section 5.`));
      } else {
        return res.text();
      }
    }) :
    readFile(path, 'utf8');
};

module.exports = {
  getSDP,
  checkRFC4566,
  checkRFC4570,
  checkST2110
};

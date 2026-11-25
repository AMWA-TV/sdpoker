/* Copyright (C) 2026 Advanced Media Workflow Association

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

// A line ends with CRLF, CR or LF. Blank lines are kept, so that line numbers
// count them.
const splitLines = sdp => sdp.replace(/(\r\n?|\n)$/, '').split(/\r\n?|\n/);

// An error found at a line of an SDP file, numbered from 1 as by splitLines.
// The message starts with the line number, which is also the line property.
class LineError extends Error {
  constructor(line, message) {
    super(`Line ${line}: ${message}`);
    this.line = line;
  }
}

module.exports = {
  splitLines,
  LineError
};

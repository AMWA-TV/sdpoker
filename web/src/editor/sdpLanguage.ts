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

import { StreamLanguage } from '@codemirror/language';

// Highlights the type letter of each line, the name of each attribute, and
// numbers. A line that does not start with a type letter is invalid. Attribute
// names use the 'typeName' style, because the default highlight style has no
// style for property names.
export const sdpLanguage = StreamLanguage.define<{ attribute: boolean }>({
  name: 'sdp',
  startState: () => ({ attribute: false }),
  token(stream, state) {
    if (stream.sol()) {
      state.attribute = stream.match(/^a=/, false) !== null;
      if (stream.match(/^[a-z]=/)) {
        return 'keyword';
      }
      stream.skipToEnd();
      return 'invalid';
    }
    if (state.attribute) {
      state.attribute = false;
      if (stream.match(/^[\w-]+/)) {
        return 'typeName';
      }
    }
    if (stream.match(/^\d+(\.\d+)*/)) {
      return 'number';
    }
    stream.next();
    return null;
  },
});

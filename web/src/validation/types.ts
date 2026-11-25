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

export interface ValidationOptions {
  checkEndings: boolean;
  should: boolean;
  noCopy: boolean;
  noMedia: boolean;
  duplicate: boolean;
  skipRFC4566: boolean;
  skipRFC4570: boolean;
  skipST2110: boolean;
  channelOrder: boolean;
  useIP4: boolean;
  useIP6: boolean;
  multicast: boolean;
  unicast: boolean;
  shaping: boolean;
  midLast: boolean;
}

export type Validator = 'RFC 4566' | 'RFC 4570' | 'ST 2110';

export interface Diagnostic {
  id: string;
  validator: Validator;
  message: string;
  // Physical line in the SDP text, counting blank lines
  line?: number;
}

export interface ValidationResult {
  diagnostics: Diagnostic[];
  errorCount: number;
  durationMs: number;
}

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

import type { ValidationOptions } from './types';

// The defaults of the sdpoker command-line options
export const defaultOptions: ValidationOptions = {
  checkEndings: false,
  should: false,
  noCopy: true,
  noMedia: true,
  duplicate: false,
  skipRFC4566: false,
  skipRFC4570: false,
  skipST2110: false,
  channelOrder: false,
  useIP4: false,
  useIP6: false,
  multicast: false,
  unicast: false,
  shaping: true,
  midLast: false,
};

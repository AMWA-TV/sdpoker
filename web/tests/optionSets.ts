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

import { defaultOptions } from '../src/validation/defaults';
import type { ValidationOptions } from '../src/validation/types';

export const optionSets: Record<string, ValidationOptions> = {
  defaults: defaultOptions,
  shouldMidLast: { ...defaultOptions, should: true, midLast: true },
  duplicateWithEndings: { ...defaultOptions, duplicate: true, checkEndings: true },
  ip6MulticastNoRFC4570: { ...defaultOptions, useIP6: true, multicast: true, skipRFC4570: true },
};

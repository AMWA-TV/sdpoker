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

import rfc4566 from '../../../checkRFC4566.js';
import rfc4570 from '../../../checkRFC4570.js';
import st2110 from '../../../checkST2110.js';
import type { Diagnostic, ValidationOptions, ValidationResult, Validator } from './types';

type Check = (sdp: string, params: ValidationOptions) => (Error & { line?: number })[];

export const validators: { validator: Validator; skip: keyof ValidationOptions; check: Check }[] = [
  { validator: 'RFC 4566', skip: 'skipRFC4566', check: rfc4566.allSections },
  { validator: 'RFC 4570', skip: 'skipRFC4570', check: rfc4570.allSections },
  { validator: 'ST 2110', skip: 'skipST2110', check: st2110.allSections },
];

export function validateSDP(sdp: string, options: ValidationOptions): ValidationResult {
  const start = performance.now();
  const diagnostics: Diagnostic[] = [];
  const add = (validator: Validator, message: string, line?: number) =>
    diagnostics.push({ id: `${diagnostics.length}`, validator, message, line });

  if (sdp.length === 0) {
    add('RFC 4566', 'The SDP file is empty.');
  } else {
    // The command-line tool passes its options object to every check,
    // including 'verbose', which is always off here
    const params = { ...options, verbose: false };
    for (const { validator, skip, check } of validators) {
      if (options[skip]) {
        continue;
      }
      try {
        for (const error of check(sdp, params)) {
          add(validator, error.message, error.line);
        }
      } catch (e) {
        add(
          validator,
          `The ${validator} checks stopped with an unexpected error: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  return {
    diagnostics,
    errorCount: diagnostics.length,
    durationMs: performance.now() - start,
  };
}

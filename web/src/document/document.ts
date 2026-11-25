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

import type { ValidationOptions } from '../validation/types';

export type InputSource = 'paste' | 'file' | 'example' | 'manual';

export interface SDPDocument {
  source: InputSource;
  name?: string;
  // Repository path of an example or test fixture
  path?: string;
  // The file or example as read, before the editor normalises its line endings
  originalText?: string;
  editorText: string;
  modified: boolean;
}

export const emptyDocument: SDPDocument = { source: 'manual', editorText: '', modified: false };

export function openOriginal(source: 'file' | 'example', name: string, text: string, path?: string): SDPDocument {
  return { source, name, path, originalText: text, editorText: text, modified: false };
}

export function applyEdit(document: SDPDocument, editorText: string, paste: boolean): SDPDocument {
  if (paste && document.editorText === '') {
    return { source: 'paste', editorText, modified: false };
  }
  return { ...document, editorText, modified: true };
}

export function reset(document: SDPDocument): SDPDocument {
  return document.originalText !== undefined
    ? { ...document, editorText: document.originalText, modified: false }
    : document;
}

// The original line endings are known only for an unmodified file or example
export function lineEndingsAvailable(document: SDPDocument): boolean {
  return document.originalText !== undefined && !document.modified;
}

export function validationInput(document: SDPDocument, options: ValidationOptions) {
  const original = lineEndingsAvailable(document);
  return {
    text: original ? document.originalText! : document.editorText,
    options: { ...options, checkEndings: original && options.checkEndings },
  };
}

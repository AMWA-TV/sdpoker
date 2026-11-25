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

import { RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, gutter, GutterMarker, type DecorationSet } from '@codemirror/view';
import type { Diagnostic } from '../validation/types';

class ErrorMarker extends GutterMarker {
  constructor(readonly messages: string) {
    super();
  }
  eq(other: ErrorMarker) {
    return other.messages === this.messages;
  }
  toDOM() {
    const marker = document.createElement('span');
    marker.className = 'cm-sdp-error-marker';
    marker.textContent = '●';
    marker.title = this.messages;
    return marker;
  }
}

export const setDiagnostics = StateEffect.define<Diagnostic[]>();

interface DiagnosticState {
  lines: DecorationSet;
  markers: RangeSet<GutterMarker>;
}

const diagnosticState = StateField.define<DiagnosticState>({
  create: () => ({ lines: Decoration.none, markers: RangeSet.empty }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDiagnostics)) {
        const byLine = new Map<number, string[]>();
        for (const { line, message } of effect.value) {
          if (line !== undefined && line <= tr.state.doc.lines) {
            byLine.set(line, [...(byLine.get(line) ?? []), message]);
          }
        }
        const lines = [...byLine.keys()].sort((a, b) => a - b);
        const from = (line: number) => tr.state.doc.line(line).from;
        return {
          lines: Decoration.set(lines.map((line) => Decoration.line({ class: 'cm-sdp-error-line' }).range(from(line)))),
          markers: RangeSet.of(lines.map((line) => new ErrorMarker(byLine.get(line)!.join('\n')).range(from(line)))),
        };
      }
    }
    // Keep the markers on their lines while the user edits
    return tr.docChanged ? { lines: value.lines.map(tr.changes), markers: value.markers.map(tr.changes) } : value;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.lines),
});

export const diagnosticsExtension: Extension = [
  diagnosticState,
  gutter({ class: 'cm-sdp-error-gutter', markers: (view) => view.state.field(diagnosticState).markers }),
  EditorView.baseTheme({
    '.cm-sdp-error-line': { backgroundColor: 'rgba(211, 47, 47, 0.12)' },
    '.cm-sdp-error-marker': { color: '#d32f2f', cursor: 'default', padding: '0 2px' },
  }),
];

export function showLine(view: EditorView, line: number) {
  if (line > view.state.doc.lines) {
    return;
  }
  const { from, to } = view.state.doc.line(line);
  view.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: 'center' }) });
  view.focus();
}

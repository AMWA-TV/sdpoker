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

import { Prec } from '@codemirror/state';
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';
import { diagnosticsExtension } from '../editor/diagnostics';

interface Props {
  value: string;
  onEdit: (text: string, paste: boolean) => void;
  onDropFile: (file: File) => void;
  onValidate: () => void;
  onCreateEditor: (view: EditorView) => void;
}

export default function SdpEditor({ value, onEdit, onDropFile, onValidate, onCreateEditor }: Props) {
  const extensions = useMemo(
    () => [
      diagnosticsExtension,
      Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => (onValidate(), true) }])),
      EditorView.domEventHandlers({
        // Open a dropped file as a document, rather than inserting its text
        drop(event) {
          const file = event.dataTransfer?.files[0];
          if (!file) {
            return false;
          }
          event.preventDefault();
          onDropFile(file);
          return true;
        },
      }),
    ],
    [onValidate, onDropFile],
  );

  const handleChange = (text: string, update: ViewUpdate) => {
    // The editor also reports the changes made when a document is loaded
    if (
      update.transactions.some(
        (tr) =>
          tr.isUserEvent('input') ||
          tr.isUserEvent('delete') ||
          tr.isUserEvent('undo') ||
          tr.isUserEvent('redo') ||
          tr.isUserEvent('move'),
      )
    ) {
      onEdit(
        text,
        update.transactions.some((tr) => tr.isUserEvent('input.paste')),
      );
    }
  };

  return (
    <CodeMirror
      value={value}
      height="100%"
      style={{ height: '100%', fontSize: 14 }}
      extensions={extensions}
      onChange={handleChange}
      onCreateEditor={onCreateEditor}
      basicSetup={{ foldGutter: false, autocompletion: false }}
      aria-label="SDP editor"
    />
  );
}

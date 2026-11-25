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

import { Alert, Box, Chip, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { validators } from '../validation/sdpoker';
import MessageText from './MessageText';
import type { Diagnostic, ValidationOptions, ValidationResult } from '../validation/types';

interface Props {
  result?: ValidationResult;
  options?: ValidationOptions;
  stale: boolean;
  onShowLine: (line: number) => void;
}

export default function ResultsPanel({ result, options, stale, onShowLine }: Props) {
  if (!result || !options) {
    return (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        Select Validate, or press Ctrl+Enter in the editor, to check the SDP.
      </Typography>
    );
  }

  return (
    <Box sx={{ p: 2 }} data-testid="results">
      {stale && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Out of date: the SDP or the options have changed since it was checked.
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h6" component="h2">
          Validation results
        </Typography>
        <Chip
          label={`${result.errorCount} error${result.errorCount === 1 ? '' : 's'}`}
          color={result.errorCount ? 'error' : 'success'}
          data-testid="error-count"
        />
        <Typography variant="caption" color="text.secondary" data-testid="duration">
          {result.durationMs.toFixed(1)} ms
        </Typography>
      </Stack>
      {!result.lineEndingsChecked && (
        <Alert severity="info" sx={{ mb: 1 }} data-testid="endings-skipped">
          Line-ending validation skipped because the original line endings cannot be guaranteed after editing. All other
          selected validation checks have been performed.
        </Alert>
      )}
      {validators.map(({ validator, skip }) => {
        const diagnostics = result.diagnostics.filter((d) => d.validator === validator);
        return (
          <Box key={validator} component="section" aria-label={validator} sx={{ mb: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle1" component="h3">
                {validator}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={options[skip] ? 'skipped' : `${diagnostics.length} error${diagnostics.length === 1 ? '' : 's'}`}
                color={options[skip] ? 'default' : diagnostics.length ? 'error' : 'success'}
                data-testid="validator-count"
              />
            </Stack>
            <List dense disablePadding>
              {diagnostics.map((diagnostic) => (
                <DiagnosticItem key={diagnostic.id} diagnostic={diagnostic} onShowLine={onShowLine} />
              ))}
            </List>
          </Box>
        );
      })}
    </Box>
  );
}

function DiagnosticItem({ diagnostic, onShowLine }: { diagnostic: Diagnostic; onShowLine: (line: number) => void }) {
  const { line, message } = diagnostic;
  // The chip shows the line, so the message does not repeat it
  const prefix = `Line ${line}: `;
  const text = (
    <ListItemText
      primary={
        <MessageText
          message={line !== undefined && message.startsWith(prefix) ? message.slice(prefix.length) : message}
        />
      }
      slotProps={{ primary: { sx: { fontFamily: 'monospace' } } }}
    />
  );
  return line !== undefined ? (
    <ListItemButton onClick={() => onShowLine(line)} data-testid="diagnostic" data-line={line}>
      <Chip size="small" label={`Line ${line}`} sx={{ mr: 1 }} />
      {text}
    </ListItemButton>
  ) : (
    <Box sx={{ px: 2, py: 0.5 }} data-testid="diagnostic">
      {text}
    </Box>
  );
}

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

import { Box, Button, Checkbox, FormControlLabel, FormGroup, Tooltip, Typography } from '@mui/material';
import { optionDisabled, optionGroups } from '../validation/optionInfo';
import type { ValidationOptions } from '../validation/types';

interface Props {
  options: ValidationOptions;
  endingsAvailable: boolean;
  onChange: (options: ValidationOptions) => void;
  onReset: () => void;
}

export default function OptionsPanel({ options, endingsAvailable, onChange, onReset }: Props) {
  return (
    <Box sx={{ p: 2 }} component="section" aria-label="Validation options">
      {optionGroups.map(({ title, options: group }) => (
        <Box key={title} sx={{ mb: 1 }}>
          <Typography variant="subtitle2" component="h3">
            {title}
          </Typography>
          <FormGroup row>
            {group.map(({ key, label, description }) => {
              const endings = key === 'checkEndings';
              const disabled = (endings && !endingsAvailable) || optionDisabled(options, key);
              const tooltip =
                endings && !endingsAvailable
                  ? 'Unavailable, because the original line endings of pasted, typed or edited SDP are unknown'
                  : description;
              return (
                <Tooltip key={key} title={tooltip} describeChild>
                  <FormControlLabel
                    disabled={disabled}
                    label={label}
                    control={
                      <Checkbox
                        size="small"
                        checked={options[key] && !(endings && !endingsAvailable)}
                        onChange={(event) => onChange({ ...options, [key]: event.target.checked })}
                      />
                    }
                  />
                </Tooltip>
              );
            })}
          </FormGroup>
        </Box>
      ))}
      <Button size="small" onClick={onReset}>
        Reset options to defaults
      </Button>
    </Box>
  );
}

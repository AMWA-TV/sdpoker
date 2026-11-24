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

import DarkModeIcon from '@mui/icons-material/DarkMode';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LightModeIcon from '@mui/icons-material/LightMode';
import GitHubIcon from '@mui/icons-material/GitHub';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Autocomplete,
  Box,
  Button,
  CssBaseline,
  IconButton,
  Link,
  Stack,
  TextField,
  Toolbar,
  ThemeProvider,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material';
import type { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import OptionsPanel from './components/OptionsPanel';
import ResultsPanel from './components/ResultsPanel';
import SdpEditor from './components/SdpEditor';
import {
  applyEdit,
  emptyDocument,
  lineEndingsAvailable,
  openOriginal,
  reset,
  validationInput,
  type SDPDocument,
} from './document/document';
import amwaLogo from './assets/AMWA-logo.png';
import { setDiagnostics, showLine } from './editor/diagnostics';
import { defaultOptions } from './validation/defaults';
import { detectLineEndings } from './validation/lines';
import { validateSDP } from './validation/sdpoker';
import type { ValidationOptions, ValidationResult } from './validation/types';

const repositoryUrl = 'https://github.com/AMWA-TV/sdpoker';

// The colours of the AMWA specification pages
const amwaBlue = '#418ab3';
const amwaLightBlue = '#a5cadf';
const amwaHeaderText = '#d1e4ef';

interface ManifestEntry {
  id: string;
  group: string;
  name: string;
  path: string;
}

interface Checked {
  result: ValidationResult;
  options: ValidationOptions;
  editorText: string;
}

export default function App() {
  const [document, setDocument] = useState<SDPDocument>(emptyDocument);
  const [options, setOptions] = useState<ValidationOptions>(defaultOptions);
  const [checked, setChecked] = useState<Checked>();
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [example, setExample] = useState<ManifestEntry | null>(null);
  const view = useRef<EditorView>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dark, setDark] = useState(() => localStorage.getItem('sdpoker-theme') === 'dark');
  const theme = useMemo(
    () =>
      createTheme({
        palette: { mode: dark ? 'dark' : 'light', primary: { main: dark ? amwaLightBlue : amwaBlue } },
      }),
    [dark],
  );

  useEffect(() => localStorage.setItem('sdpoker-theme', dark ? 'dark' : 'light'), [dark]);

  useEffect(() => {
    fetch('./sdp/manifest.json')
      .then((response) => response.json())
      .then(setManifest)
      .catch(() => setManifest([]));
  }, []);

  const load = (next: SDPDocument) => {
    setDocument(next);
    setChecked(undefined);
    view.current?.dispatch({ effects: setDiagnostics.of([]) });
    if (next.originalText !== undefined) {
      setOptions((current) => ({ ...current, checkEndings: true }));
    }
  };

  const openFile = useCallback((file: File) => {
    file.text().then((text) => {
      setExample(null);
      load(openOriginal('file', file.name, text));
    });
  }, []);

  const openExample = (entry: ManifestEntry | null) => {
    setExample(entry);
    if (entry) {
      fetch(`./sdp/${entry.path}`)
        .then((response) => response.text())
        .then((text) => load(openOriginal('example', entry.name, text, entry.path)));
    }
  };

  const validate = useCallback(() => {
    const input = validationInput(document, options);
    const result = validateSDP(input.text, input.options);
    setChecked({ result, options: input.options, editorText: document.editorText });
    view.current?.dispatch({ effects: setDiagnostics.of(result.diagnostics) });
  }, [document, options]);

  const endingsAvailable = lineEndingsAvailable(document);
  const resetOptions = { ...defaultOptions, checkEndings: endingsAvailable };
  const changedOptions = (Object.keys(resetOptions) as (keyof ValidationOptions)[]).filter(
    (key) => (key === 'checkEndings' ? options.checkEndings && endingsAvailable : options[key]) !== resetOptions[key],
  ).length;
  const lineCount = document.editorText === '' ? 0 : document.editorText.split('\n').length;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" elevation={0} enableColorOnDark sx={{ bgcolor: amwaBlue, color: amwaHeaderText }}>
          <Toolbar variant="dense">
            <Link href="https://www.amwa.tv" sx={{ display: 'flex', mr: 1.5 }}>
              <img src={amwaLogo} alt="AMWA logo" style={{ height: 25, display: 'block' }} />
            </Link>
            <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              SDPoker
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {' '}
                · SMPTE ST 2110 SDP checker
              </Box>
            </Typography>
            <IconButton
              color="inherit"
              onClick={() => setDark(!dark)}
              aria-label={dark ? 'Use light mode' : 'Use dark mode'}
            >
              {dark ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <IconButton color="inherit" href={repositoryUrl} aria-label="SDPoker on GitHub">
              <GitHubIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ p: 1, flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => fileInput.current?.click()}>
              Open SDP file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".sdp,application/sdp,text/plain"
              hidden
              data-testid="file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  openFile(file);
                }
                event.target.value = '';
              }}
            />
            <Autocomplete
              sx={{ width: { xs: '100%', sm: 380 } }}
              size="small"
              options={manifest}
              groupBy={(entry) => entry.group}
              getOptionLabel={(entry) => entry.name}
              value={example}
              onChange={(_, entry) => openExample(entry)}
              renderInput={(params) => <TextField {...params} label="Load an example or test fixture" />}
            />
            <Button
              onClick={() => {
                setExample(null);
                load(emptyDocument);
              }}
            >
              Clear
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="contained" onClick={validate}>
              Validate
            </Button>
          </Stack>

          <Group orientation="vertical" style={{ flexGrow: 1, minHeight: 0 }}>
            <Panel id="editor" defaultSize="55" minSize="15" style={{ display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flexGrow: 1, minHeight: 0, border: 1, borderColor: 'divider' }} data-testid="editor-panel">
                <SdpEditor
                  value={document.editorText}
                  onEdit={(text, paste) => setDocument((current) => applyEdit(current, text, paste))}
                  onDropFile={openFile}
                  onValidate={validate}
                  onCreateEditor={(editor) => (view.current = editor)}
                  dark={dark}
                />
              </Box>
              <Stack
                direction="row"
                spacing={2}
                useFlexGap
                sx={{ px: 1, py: 0.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 0 }}
                data-testid="status"
              >
                <Typography variant="body2">
                  {document.name ?? (document.source === 'paste' ? 'Pasted SDP' : 'New SDP')}
                </Typography>
                <Typography variant="body2">
                  {lineCount} line{lineCount === 1 ? '' : 's'}
                </Typography>
                <Typography variant="body2" data-testid="line-endings">
                  {endingsAvailable
                    ? `Original line endings (${detectLineEndings(document.originalText!)})`
                    : 'Original line endings unknown'}
                </Typography>
                {document.path && (
                  <Link
                    variant="body2"
                    href={`${repositoryUrl}/blob/master/${document.path}`}
                    data-testid="github-link"
                  >
                    {document.path} on GitHub
                  </Link>
                )}
                <Box sx={{ flexGrow: 1 }} />
                {document.modified && document.originalText !== undefined && (
                  <Tooltip title={`Revert to ${document.name} as opened`} describeChild>
                    <Button size="small" sx={{ py: 0 }} onClick={() => load(reset(document))}>
                      Revert to original
                    </Button>
                  </Tooltip>
                )}
              </Stack>
            </Panel>
            <Separator aria-label="Resize the editor and results">
              <Box sx={{ height: 6, bgcolor: 'divider', cursor: 'row-resize' }} />
            </Separator>
            <Panel id="results" minSize="15" style={{ overflow: 'auto' }}>
              <Accordion disableGutters variant="outlined">
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  Validation options
                  {changedOptions > 0 && (
                    <Typography component="span" color="text.secondary" sx={{ ml: 1 }} data-testid="changed-options">
                      · {changedOptions} changed from defaults
                    </Typography>
                  )}
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <OptionsPanel
                    options={options}
                    endingsAvailable={endingsAvailable}
                    onChange={setOptions}
                    canReset={changedOptions > 0}
                    onReset={() => setOptions(resetOptions)}
                  />
                </AccordionDetails>
              </Accordion>

              <ResultsPanel
                result={checked?.result}
                options={checked?.options}
                stale={checked !== undefined && checked.editorText !== document.editorText}
                onShowLine={(line) => view.current && showLine(view.current, line)}
              />
            </Panel>
          </Group>
        </Box>

        <Box component="footer" sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" data-testid="privacy">
            SDP validation is performed entirely within your browser. Your SDP contents are not uploaded to a server.
          </Typography>
          <Typography variant="body2" color="text.secondary" data-testid="version">
            SDPoker {__SDPOKER_VERSION__}, built from{' '}
            <Link href={`${repositoryUrl}/commit/${__SDPOKER_COMMIT__}`}>{__SDPOKER_COMMIT__}</Link>
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

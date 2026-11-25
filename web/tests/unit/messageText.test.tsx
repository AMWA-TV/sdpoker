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

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MessageText from '../../src/components/MessageText';

describe('MessageText', () => {
  it('renders markup in a message as text, and citations as links', () => {
    const html = renderToStaticMarkup(<MessageText message="Line 1: '<b>x</b>', as per RFC 4566 Section 5." />);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toMatch(
      /<a [^>]*href="https:\/\/www.rfc-editor.org\/rfc\/rfc4566#section-5"[^>]*>RFC 4566 Section 5<\/a>/,
    );
  });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('extractSectionLines keeps content after blank lines inside section', () => {
  const llmPath = path.resolve('electron/llm.js');
  delete require.cache[llmPath];
  const llm = require(llmPath);

  const text = [
    'Summary:',
    '',
    'First paragraph.',
    '',
    'Second paragraph.',
    'Key Points:',
    '- A',
    '- B'
  ].join('\n');

  const lines = llm.extractSectionLines(
    text,
    ['summary'],
    ['summary', 'key points']
  );

  assert.deepEqual(lines, ['', 'First paragraph.', '', 'Second paragraph.']);
});


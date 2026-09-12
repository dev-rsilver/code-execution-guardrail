import test from 'node:test';
import assert from 'node:assert/strict';
import { ShellParser } from '../../shell/ShellParser.js';

test('ShellParser path extraction', async (t) => {
  await t.test('parses double-quoted paths with spaces', () => {
    const content = `DEVCONTAINER_ROOTS=(" /Users/nice path" "/home/user/project")`;
    const roots = ShellParser.parseRoots(content, 'test');
    assert.deepEqual(roots, [' /Users/nice path', '/home/user/project']);
  });

  await t.test('parses single-quoted paths with spaces and parens', () => {
    const content = `DEVCONTAINER_ROOTS=(' /Users/nice path' '/home/user/proj (v1)')`;
    const roots = ShellParser.parseRoots(content, 'test');
    assert.deepEqual(roots, [' /Users/nice path', '/home/user/proj (v1)']);
  });

  await t.test('parses mixed quoted paths', () => {
    const content = `DEVCONTAINER_ROOTS=(" /mixed quotes" '/single quotes')`;
    const roots = ShellParser.parseRoots(content, 'test');
    assert.deepEqual(roots, [' /mixed quotes', '/single quotes']);
  });

  await t.test('handles adjacent quoted strings (shell concatenation)', () => {
    const content = `DEVCONTAINER_ROOTS=('part1''part2' "/part3" 'part4')`;
    const roots = ShellParser.parseRoots(content, 'test');
    assert.deepEqual(roots, ['part1part2', '/part3', 'part4']);
  });

  await t.test('handles escaped single quotes (standard shell escape sequence)', () => {
    const content = `DEVCONTAINER_ROOTS=('Project'\\''s Folder' '/another/path')`;
    const roots = ShellParser.parseRoots(content, 'test');
    assert.deepEqual(roots, ["Project's Folder", '/another/path']);
  });

  await t.test('handles a complex escaped single quote sequence', () => {
    const content = `DEVCONTAINER_ROOTS=('a'\\''b' 'c')`;
    const roots = ShellParser.parseRoots(content, 'test');
    assert.deepEqual(roots, ["a'b", 'c']);
  });

  await t.test('handles escaped quotes inside double-quoted paths', () => {
    const content = `DEVCONTAINER_ROOTS=("Path with \\"quoted\\" interior")`;
    const roots = ShellParser.parseRoots(content, 'test');
    assert.deepEqual(roots, ['Path with "quoted" interior']);
  });

  await t.test('throws on unquoted paths', () => {
    const content = `DEVCONTAINER_ROOTS=( /home/user/unquoted )`;
    assert.throws(() => ShellParser.parseRoots(content, 'test'), /Malformed path detected/);
  });

  await t.test('handles complex whitespace and trailing spaces', () => {
    const content = `DEVCONTAINER_ROOTS=(  "/path1" \t "/path2"   )`;
    const roots = ShellParser.parseRoots(content, 'test');
    assert.deepEqual(roots, ['/path1', '/path2']);
  });

  await t.test('handles empty arrays and noise', () => {
     assert.deepEqual(ShellParser.parseRoots('', 'test'), []);
     assert.deepEqual(ShellParser.parseRoots('SOME_OTHER_VAR=(1 2 3)', 'test'), []);
  });

  await t.test('extracts binary function names', () => {
    const content = `
      ls() { _block_if_devcontainer ls "$@"; }
      grep() { _block_if_devcontainer grep "$@"; }
      not_a_block() { echo hello; }
    `;
    const bins = ShellParser.parseBinaries(content);
    assert.deepEqual(bins, ['ls', 'grep']);
  });
});

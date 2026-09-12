import test from 'node:test';
import assert from 'node:assert/strict';
import { LockerGenerator } from '../../shell/LockerGenerator.js';

test('LockerGenerator output', async (t) => {
  await t.test('shellSingleQuote escapes single quotes correctly', () => {
    assert.equal(LockerGenerator.shellSingleQuote("it's"), "'it'\\''s'");
    assert.equal(LockerGenerator.shellSingleQuote("normal"), "'normal'");
  });

  await t.test('generateScript produces valid shell code for roots and bins', () => {
    const result = LockerGenerator.generateScript({ 
      roots: ['/root one', "/root's two", '/path(with)parens'], 
      bins: ['ls', 'git'] 
    });
    
    assert.match(result, /DEVCONTAINER_ROOTS\s*=\s*\(.*\)/);
    assert.match(result, /'\/root one'/);
    assert.match(result, /'\/root'\\''s two'/);
    assert.match(result, /'\/path\(with\)parens'/);
    assert.match(result, /ls\(\) \{ _block_if_devcontainer ls/);
    assert.match(result, /git\(\) \{ _block_if_devcontainer git/);
  });

  await t.test('generateScript contains correct PWD matching logic', () => {
    const result = LockerGenerator.generateScript({ roots: ['/test'], bins: ['ls'] });
    
    // Test exact match and subdirectory match
    // Linux/Case-sensitive: [[ "$PWD" == "$root" || "$PWD" == "$root"/* ]]
    // macOS/Case-insensitive: [[ "$current_dir" == "$normalized_root" || "$current_dir" == "$normalized_root"/* ]]
    
    const expectedLinuxMatch = '[[ "$(pwd -P)" == "$root" || "$(pwd -P)" == "$root"/* ]]';
    const expectedMacMatch = '[[ "$current_dir" == "$normalized_root" || "$current_dir" == "$normalized_root"/* ]]';
    
    const hasCorrectMatch = result.includes(expectedLinuxMatch) || result.includes(expectedMacMatch);
    assert.ok(hasCorrectMatch, 'Should use exact match or subdirectory match logic');
    
    // Ensure it doesn't use the old prefix match logic
    assert.doesNotMatch(result, /\${PWD%%\${root,*} \*/);
    assert.doesNotMatch(result, /\${current_dir%%\${normalized_root,*} \*/);
  });
});

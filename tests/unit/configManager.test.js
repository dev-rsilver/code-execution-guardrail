import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigManager } from '../../shell/ConfigManager.js';
import { LockerGenerator } from '../../shell/LockerGenerator.js';

test('ConfigManager RC manipulation', async (t) => {
  await t.test('addSourceLine handles empty content', () => {
    const content = '';
    const path = '/home/user/.local/bin/locker.sh';
    const result = ConfigManager.addSourceLine(content, path);
    assert.equal(result, `source '${path}'\n`);
  });

  await t.test('addSourceLine handles existing content with proper separator', () => {
    const content = 'alias ll="ls -l"';
    const path = '/home/user/.local/bin/locker.sh';
    const result = ConfigManager.addSourceLine(content, path);
    // Should add two newlines before the source line if content exists
    const expectedRegex = new RegExp(`alias ll="ls -l"\\n\\nsource '${path}'\\n`);
    assert.match(result, expectedRegex);
  });

  await t.test('addSourceLine is idempotent', () => {
    const path = '/home/user/.local/bin/locker.sh';
    const sourceLine = `source '${path}'\n`;
    const content = `some config\n\n${sourceLine}`;
    const result = ConfigManager.addSourceLine(content, path);
    assert.equal(result, content);
  });

  await t.test('removeSourceLine removes existing line', () => {
    const path = '/home/user/.local/bin/locker.sh';
    const sourceLine = `source '${path}'`;
    const content = `alias ll="ls -l"\n${sourceLine}\nexport PATH=$PATH:/bin`;
    const result = ConfigManager.removeSourceLine(content, path);
    assert.doesNotMatch(result, /source '${path}'/);
    assert.match(result, /alias ll="ls -l"/);
    assert.match(result, /export PATH=\$PATH:\/bin/);
  });

  await t.test('removeSourceLine handles paths with single quotes', () => {
    const path = "/home/user/my'locker.sh";
    const sourceLine = `source '${path.replace(/'/g, "'\\''")}'`;
    const content = `alias ll="ls -l"\n${sourceLine}\n`;
    const result = ConfigManager.removeSourceLine(content, path);
    assert.doesNotMatch(result, /source '.*'/);
  });

  await t.test('removeSourceLine preserves unrelated whitespace', () => {
    const path = '/home/user/.local/bin/locker.sh';
    const sourceLine = `source '${path}'`;
    const content = `  # Indented header\n${sourceLine}\n  # Indented footer  `;
    const result = ConfigManager.removeSourceLine(content, path);
    assert.match(result, /^  # Indented header/);
    assert.match(result, /  # Indented footer  \n$/);
  });

  await t.test('removeSourceLine preserves content after the source line', () => {
    const path = '/home/user/.local/bin/locker.sh';
    const sourceLine = `source '${path}'`;
    const content = `alias ll="ls -l"\n${sourceLine}\nexport PATH=$PATH:/bin\n  # a final comment`;
    const result = ConfigManager.removeSourceLine(content, path);
    assert.match(result, /^alias ll="ls -l"/);
    assert.match(result, /export PATH=\$PATH:\/bin/);
    assert.match(result, /  # a final comment\n$/);
    assert.doesNotMatch(result, /source '${path}'/);
  });
});

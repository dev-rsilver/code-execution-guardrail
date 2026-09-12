import test from 'node:test';
import assert from 'node:assert/strict';
import { ShellParser } from '../../shell/ShellParser.js';
import { LockerGenerator } from '../../shell/LockerGenerator.js';

test('Round-trip integration', async (t) => {
  await t.test('can parse back what was generated', () => {
    const originalRoots = [
      '/Users/name/Project (v1)',
      '/Users/name/Project with spaces',
      "/Users/name/Project's Path",
      '/Users/name/Complex Path (v2) with spaces'
    ];
    const originalBins = ['ls', 'git', 'npm'];
    
    const script = LockerGenerator.generateScript({ roots: originalRoots, bins: originalBins });
    const parsedRoots = ShellParser.parseRoots(script, 'generated_script');
    const parsedBins = ShellParser.parseBinaries(script);
    
    assert.deepEqual(parsedRoots, originalRoots);
    assert.deepEqual(parsedBins, originalBins);
  });
});

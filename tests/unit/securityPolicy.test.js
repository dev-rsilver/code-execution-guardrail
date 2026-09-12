import test from 'node:test';
import assert from 'node:assert/strict';
import { SecurityPolicy } from '../../shell/SecurityPolicy.js';

test('SecurityPolicy validation', async (t) => {
  await t.test('isValidBinaryName blocks illegal characters', () => {
    assert.equal(SecurityPolicy.isValidBinaryName('ls'), true);
    assert.equal(SecurityPolicy.isValidBinaryName('my_binary123'), true);
    assert.equal(SecurityPolicy.isValidBinaryName('ls;rm'), false);
    assert.equal(SecurityPolicy.isValidBinaryName('bin-name'), false); // only a-zA-Z0-9_
  });

  await t.test('validateSafePath blocks shell meta-characters', () => {
    assert.equal(SecurityPolicy.validateSafePath('/home/user/safe'), true);
    assert.equal(SecurityPolicy.validateSafePath('/home/user/safe (v1)'), true); // Parens now allowed
    assert.equal(SecurityPolicy.validateSafePath('/home/user/$(whoami)'), false);
    assert.equal(SecurityPolicy.validateSafePath('/home/user/`id`'), false);
    assert.equal(SecurityPolicy.validateSafePath('/home/user; ls'), false);
  });

  await t.test('validateSafePath blocks sensitive system directories', () => {
    assert.equal(SecurityPolicy.validateSafePath('/etc/passwd', true), false);
    assert.equal(SecurityPolicy.validateSafePath('/usr/bin/lock', true), false);
    assert.equal(SecurityPolicy.validateSafePath('/var/log/syslog', true), false);
  });
});

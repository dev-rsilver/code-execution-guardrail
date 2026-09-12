import path from 'node:path';
import os from 'node:os';

/**
 * SecurityPolicy handles validation of paths and identifiers to prevent 
 * injection attacks in shell configuration files.
 */
export class SecurityPolicy {
  /**
   * Shell characters that result in an invalid path.
   */
  static SHELL_METACHARS = /[`$<>!;\n\r]/;

  /**
   * Regex for allowed binary names.
   */
  static BINARY_WHITELIST = /^[a-zA-Z0-9_]+$/;

  /**
   * Validates that a binary name contains only safe characters for shell function names.
   * @param {string} bin - The binary name to validate.
   * @returns {boolean} True if the binary name is valid.
   */
  static isValidBinaryName(bin) {
    return this.BINARY_WHITELIST.test(bin);
  }

  /**
   * Validates a path based on its purpose (root vs installation).
   * @param {string} p - The path to validate.
   * @param {boolean} [isInstallationDir=false] - Whether the path is an installation target.
   * @returns {boolean} True if the path is safe according to security policies.
   */
  static validateSafePath(p, isInstallationDir = false) {
    if (!p || typeof p !== 'string') return false;

    // 1. Block shell interpolation/expansion characters
    if (this.SHELL_METACHARS.test(p)) return false;

    // 2. Prevent writing to sensitive system areas
    if (isInstallationDir) {
      const home = os.homedir();
      const normalizedPath = path.normalize(p);
      const forbiddenRoots = ['/etc', '/bin', '/sbin', '/usr/bin', '/usr/sbin', '/var', '/boot', '/dev'];
      if (forbiddenRoots.some(root => normalizedPath.startsWith(root))) return false;

      if (!normalizedPath.startsWith(home)) {
        console.warn('Warning: Installing outside of home directory is generally discouraged.');
      }
    }

    return true;
  }
}

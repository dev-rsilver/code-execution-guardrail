import { LockerGenerator } from './LockerGenerator.js';

/**
 * ConfigManager handles the surgical modification of shell configuration files.
 */
export class ConfigManager {
  /**
   * Adds the source line to the configuration file if it's not already present.
   * @param {string} content - The current content of the config file.
   * @param {string} lockerFilePath - The path to the locker script.
   * @returns {string} The updated config content.
   */
  static addSourceLine(content, lockerFilePath) {
    const sourceLine = `source ${LockerGenerator.shellSingleQuote(lockerFilePath)}`;
    if (content.includes(sourceLine)) return content;

    const trimmedContent = content.trimEnd();
    const separator = trimmedContent.length > 0 ? '\n\n' : '';
    return `${trimmedContent}${separator}${sourceLine}\n`;
  }

  /**
   * Removes the source line from the configuration file.
   * @param {string} content - The current content of the config file.
   * @param {string} lockerFilePath - The path to the locker script.
   * @returns {string} The updated config content.
   */
  static removeSourceLine(content, lockerFilePath) {
    const sourceLine = `source ${LockerGenerator.shellSingleQuote(lockerFilePath)}`;
    const escapedSourceLine = sourceLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the source line: optional leading space, the line itself, 
    // optional non-newline trailing space, and the optional final newline.
    const regex = new RegExp(`^\\s*${escapedSourceLine}[^\\r\\n]*\\n?`, 'gm');
    
    const result = content.replace(regex, '');
    return result.endsWith('\n') ? result : result + '\n';
  }
}
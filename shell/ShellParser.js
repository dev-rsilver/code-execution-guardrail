/**
 * ShellParser extracts structured data from existing generated shell scripts.
 */
export class ShellParser {
  /**
   * Parses the DEVCONTAINER_ROOTS array from a shell configuration file or script.
   * @param {string} content - The file content to parse.
   * @param {string} configFileName - Name of the config file (for error reporting).
   * @returns {string[]} An array of project roots found in the script.
   * @throws {Error} If a path is detected without double-quotes.
   */
  static parseRoots(content, configFileName) {
    const startMarker = 'DEVCONTAINER_ROOTS=(';
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) { return []; }

    const existingRoots = [];
    let currentIndex = startIndex + startMarker.length;
    
    // tokenRegex logic:
    // 1. Double-quoted (?<dq>): Matches "..." and captures content (dq_content). 
    //    Handles escaped characters (e.g., \") via (?:\\.[^"\\]*)*.
    // 2. Single-quoted (?<sq>): Matches '...' and captures content (sq_content).
    // 3. Unquoted (?<unquoted>): Matches shell-escaped single quote (\') 
    //    OR any non-whitespace, non-quote sequence. This prevents it from swallowing 
    //    the rest of the path if it's a concatenated string like 'part'\' 'part2'.
    const tokenRegex = /(?<dq>"(?<dq_content>[^"\\]*(?:\\.[^"\\]*)*)")|(?<sq>'(?<sq_content>[^']*)')|(?<unquoted>\\'|[^\s'"]+)/g;

    while (currentIndex < content.length) {
      const remaining = content.slice(currentIndex);
      const whitespaceMatch = remaining.match(/^\s*/);
      const offset = whitespaceMatch ? whitespaceMatch[0].length : 0;
      
      if (remaining[offset] === ')') {
        currentIndex += offset + 1;
        break;
      }

      const slice = remaining.slice(offset);
      tokenRegex.lastIndex = 0;
      
      let fullPath = '';
      let innerIndex = 0;
      let malformed = false;

      // Process tokens to handle shell concatenation.
      while (innerIndex < slice.length) {
        tokenRegex.lastIndex = innerIndex;
        const match = tokenRegex.exec(slice);
        if (!match) break;

        if (match.index !== innerIndex) break; 

        const { dq_content, sq_content, unquoted } = match.groups;
        const fullToken = match[0];

        // If we encounter the closing paren, it's handled by the outer check or if it matches unquoted.
        if (unquoted && fullToken === ')') {
          if (fullPath) existingRoots.push(fullPath);
          currentIndex += offset + innerIndex + 1;
          return existingRoots;
        }

        if (unquoted) {
          // In shell, a single quote in a single-quoted string is written as '\''
          // which this regex splits into '...' (sq), \' (unquoted), '...' (sq).
          if (fullToken === "\\'") {
            fullPath += "'";
          } else {
            // Any other unquoted sequence is a violation of our policy.
            malformed = true;
            fullPath += unquoted;
          }
        } else if (dq_content !== undefined) {
          fullPath += dq_content.replace(/\\(.)/g, '$1');
        } else if (sq_content !== undefined) {
          fullPath += sq_content;
        }

        innerIndex += fullToken.length;
        
        if (innerIndex < slice.length && /\s/.test(slice[innerIndex])) {
          break;
        }
      }

      if (malformed) {
        throw new Error(`\n\u274C Malformed path detected in ${configFileName}: '${fullPath}'. \nAll entries must be quoted.`);
      }

      if (fullPath) {
        existingRoots.push(fullPath);
      }
      currentIndex += offset + innerIndex;
    }
    return existingRoots;
  }

  /**
   * Extracts binary interceptor function names from the script content.
   * @param {string} content - The script content to parse.
   * @returns {string[]} A list of unique binary names being intercepted.
   */
  static parseBinaries(content) {
    const bins = [];
    const binRegex = /([a-zA-Z0-9_]+)\(\)\s*{\s*_block_if_devcontainer\s+([a-zA-Z0-9_]+)/g;
    let match;
    while ((match = binRegex.exec(content)) !== null) {
      bins.push(match[1]);
    }
    return [...new Set(bins)];
  }
}
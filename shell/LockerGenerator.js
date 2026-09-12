/**
 * LockerGenerator creates the content for the shell interceptor script.
 */
export class LockerGenerator {
  /**
   * Wraps a string in single quotes and escapes internal single quotes
   * to ensure it is treated as a literal by the shell.
   * @param {string} p - The path or string to quote.
   * @returns {string} A shell-safe single-quoted string.
   */
  static shellSingleQuote(p) {
    return `'${p.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Generates the full content of the container-locker.sh script.
   * @param {Object} config - Generation configuration.
   * @param {string[]} config.roots - List of project roots to lock.
   * @param {string[]} config.bins - List of binary names to intercept.
   * @returns {string} The generated shell script content.
   */
  static generateScript({ roots, bins }) {
    const declaration = process.env.SHELL?.includes('zsh') ? `typeset -a` : `declare -a`;
    const isCaseInsensitiveOS = process.platform === 'darwin' || process.platform === 'win32';

    const rootsList = `(${roots.map(r => this.shellSingleQuote(r)).join(' ')})`;
    
    const interceptFunctions = bins
      .map(bin => `${bin}() { _block_if_devcontainer ${bin} "$@"; }`)
      .join('\n');

    const conditionalCheck = isCaseInsensitiveOS 
      ? `        current_dir=$(pwd -P | tr '[:upper:]' '[:lower:]')\n        normalized_root=$(echo "$root" | tr '[:upper:]' '[:lower:]')\n        if [[ "$current_dir" == "$normalized_root" || "$current_dir" == "$normalized_root"/* ]]; then`
      : `        if [[ "$(pwd -P)" == "$root" || "$(pwd -P)" == "$root"/* ]]; then`;

    return `
# BEGIN DEVCONTAINER BLOCK
${declaration} DEVCONTAINER_ROOTS=${rootsList}

_block_if_devcontainer() {
    local cmd=$1
    shift
    # Exception: Allow unlock and uninstall commands to run even if blocked
    if [[ "$*" == *"setup:unlock"* ]] || [[ "$*" == *"setup:uninstall"* ]]; then
        command "$cmd" "$@"
        return
    fi

    for root in "\${DEVCONTAINER_ROOTS[@]}"; do
        [[ ! -d "$root" ]] && continue
${conditionalCheck}
            echo "\u274C Error: '$cmd' is blocked. Please use the Dev Container for this project."
            return 1
        fi
    done
    command "$cmd" "$@"
}

# Intercept binaries
${interceptFunctions}
# END DEVCONTAINER BLOCK
`;
  }
}

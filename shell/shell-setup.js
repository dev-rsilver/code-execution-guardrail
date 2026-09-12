import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { isRunningContainer } from '../containerCheck.js';
import { SecurityPolicy } from './SecurityPolicy.js';
import { ConfigManager } from './ConfigManager.js';
import { LockerGenerator } from './LockerGenerator.js';
import { ShellParser } from './ShellParser.js';

/**
 * Entry point for the shell setup utility.
 */
async function setup() {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!['lock', 'unlock', 'uninstall'].includes(command)) {
    console.log('Usage: node shell-setup.js [lock [bins...] | unlock | uninstall]');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let absoluteRoot;
  try { absoluteRoot = path.resolve(await fs.realpath(process.cwd())); } catch (e) { 
    console.log("Error: " + e.message)
    process.exit(1); }

  const shellPath = process.env.SHELL || '';
  const configFile = shellPath.includes('zsh') ? path.join(os.homedir(), '.zshrc') : 
                     shellPath.includes('bash') ? path.join(os.homedir(), `.bashrc`) : null;

  if (!configFile) { console.error('\u274C Unsupported shell.'); rl.close(); process.exit(1); }

  const defaultLockerDir = path.join(os.homedir(), '.local', 'bin', 'container-locker');

  if (command === 'uninstall') { await handleUninstall(configFile, rl); }
  else if (command === 'unlock') { await handleUnlock(configFile, absoluteRoot, rl); }
  else if (command === 'lock') {
    const bins = args.slice(1);
    if (!bins.length) { console.error('\u274C Bins required for lock.'); rl.close(); process.exit(1); }
    for (const b of bins) {
      if (!SecurityPolicy.isValidBinaryName(b)) { 
        console.error(`\u274C Invalid bin: ${b}`); 
        rl.close(); 
        process.exit(1); 
      }
    }
    await handleLock(configFile, absoluteRoot, bins, defaultLockerDir, rl);
  }
  rl.close();
}

/**
 * Handles `npm run setup lock`, which is used to lock the current directory
 * from binary execution.
 */
async function handleLock(configFilePath, absoluteRootPath, newBins, defaultLockerDir, rl) {
  if (!configFilePath || !absoluteRootPath || !Array.isArray(newBins) || !defaultLockerDir) {
    console.error('\u274C Error: Missing or invalid arguments for handleLock.');
    return;
  }

  if (isRunningContainer()) {
    console.error('\u274C Error: You cannot run setup:lock from inside a container.');
    console.error('The locker is intended to prevent execution on the host machine to force you into the container.');
    return;
  }

  if (!SecurityPolicy.validateSafePath(configFilePath)) {
    console.error(`\u274C Error: Configuration file path is invalid: ${configFilePath}`);
    return;
  }

  if (!SecurityPolicy.validateSafePath(absoluteRootPath)) {
    console.error(`\u274C Error: Project root path contains illegal characters: ${absoluteRootPath}`);
    return;
  }

  if (!SecurityPolicy.validateSafePath(defaultLockerDir, true)) {
    console.error(`\u274C Error: default installation directory is invalid: ${defaultLockerDir}`);
    return;
  }

  console.log("Setup Lock Initiated.");
  console.log(`\nResolved Project Root: ${absoluteRootPath}`);
  const rootAnswer = await rl.question('Is this the root of your project? (y/n): ');
  if (!['y', 'yes'].includes(rootAnswer.toLowerCase())) {
    console.log('\u274C Setup cancelled.');
    return;
  }

  let lockerDir = defaultLockerDir;
  const lockerFilePath = path.join(lockerDir, 'container-locker.sh');
  let content = '';
  try { content = await fs.readFile(lockerFilePath, 'utf8'); } catch (e) {}

  const configContent = await fs.readFile(configFilePath, 'utf8').catch(() => '');
  const isRegistered = configContent.includes(`source ${LockerGenerator.shellSingleQuote(lockerFilePath)}`);

  if (isRegistered) {
    console.log(`\nLocker utility is already installed in ${configFilePath}.`);
  } else {
    console.log(`\nInstallation directory: ${defaultLockerDir}`);
    const pathAnswer = await rl.question('Accept installation path? (y/n): ');
    if (!['y', 'yes'].includes(pathAnswer.toLowerCase())) {
      const customPath = await rl.question('Enter custom installation directory: ');
      const resolvedCustomPath = path.resolve(customPath);
      if (!SecurityPolicy.validateSafePath(resolvedCustomPath, true)) {
        console.error(`\u274C Error: Installation path is invalid or in a forbidden system directory.`);
        return;
      }
      lockerDir = resolvedCustomPath;
    }
  }

  const finalLockerFilePath = path.join(lockerDir, 'container-locker.sh');
  if (!SecurityPolicy.validateSafePath(finalLockerFilePath)) {
    console.error(`\u274C Error: Installation path is invalid or in a forbidden system directory.`);
    return;
  }

  const existingRoots = ShellParser.parseRoots(content, finalLockerFilePath);
  const resolvedRoots = [];
  const deadRoots = [];

  if (existingRoots.includes(absoluteRootPath)) {
    console.log(`\nProject is already locked.`);
    const updateAnswer = await rl.question('Do you want to update the intercepting binaries? (y/n): ');
    if (!['y', 'yes'].includes(updateAnswer.toLowerCase())) {
      console.log('\u2705 No changes needed.');
      return;
    }
  }

  for (const root of existingRoots) {
    try {
      await fs.stat(root);
      resolvedRoots.push(root);
    } catch (e) { deadRoots.push(root); }
  }

  if (deadRoots.length > 0) {
    console.log(`\nWarning: Dead roots found:`);
    deadRoots.forEach(r => console.log(`   - ${r}`));
    const clean = await rl.question('\nRemove these dead paths? (y/n): ');
    if (!['y', 'yes'].includes(clean.toLowerCase())) {
      resolvedRoots.push(...deadRoots);
    }
  }

  let finalRoots = resolvedRoots;
  if (!finalRoots.includes(absoluteRootPath)) {
    if (!SecurityPolicy.validateSafePath(absoluteRootPath)) {
      console.error(`\u274C Error: Resolved project root contains illegal characters.`);
      return;
    }
    finalRoots.push(absoluteRootPath);
  }

  const allBins = [...new Set([...ShellParser.parseBinaries(content), ...newBins])];
  const lockerScriptContent = LockerGenerator.generateScript({ roots: finalRoots, bins: allBins });

  try {
    await fs.mkdir(lockerDir, { recursive: true });
    await fs.writeFile(finalLockerFilePath, lockerScriptContent, 'utf8');
    console.log(`\n\u2705 Locker script updated at ${finalLockerFilePath}`);

    let configContentFinal = await fs.readFile(configFilePath, 'utf8').catch(() => '');
    const updatedConfig = ConfigManager.addSourceLine(configContentFinal, finalLockerFilePath);
    
    if (updatedConfig !== configContentFinal) {
      await fs.writeFile(configFilePath, updatedConfig, 'utf8');
      console.log(`\t\u2705 Registered in ${configFilePath}`);
    }

    console.log(`\tRegistered Roots: \n${finalRoots.join('\n')}`);
    console.log(`\tIntercepting: ${allBins.join(', ')}`);
    console.log(`\nPlease restart your terminal or run 'source ${configFilePath}' to apply the changes.`);
  } catch (err) { console.error('\u274C Setup failed:', err); }
}

/**
 * Removes a specific project root from the locker script logic.
 */
async function handleUnlock(configFilePath, absoluteRootPath, rl) {
  const configContent = await fs.readFile(configFilePath, 'utf8').catch(() => '');
  const sourceMatch = configContent.match(/source\s+(['"])(.*?)\1\s*$/m) || configContent.match(/source\s+([^\s\n\r]+)\s*$/m);
  
  let lockerFilePath = null;
  if (sourceMatch) {
    const pathCandidate = sourceMatch[2] || sourceMatch[1];
    if (pathCandidate && pathCandidate.includes('container-locker.sh')) {
      lockerFilePath = pathCandidate;
    }
  }

  if (!lockerFilePath) return console.error('\u274C No locker script found in config.');

  if (!SecurityPolicy.validateSafePath(lockerFilePath, true)) {
    return console.error(`\u274C The sourced locker path is invalid or unsafe: ${lockerFilePath}`);
  }

  try {
    const content = await fs.readFile(lockerFilePath, 'utf8');
    const roots = ShellParser.parseRoots(content, lockerFilePath);
    if (!roots.includes(absoluteRootPath)) return console.log(`\nProject ${absoluteRootPath} is not locked.`);

    const filteredRoots = roots.filter(r => r !== absoluteRootPath);
    const currentBins = ShellParser.parseBinaries(content);
    const updatedContent = LockerGenerator.generateScript({ roots: filteredRoots, bins: currentBins });
    
    await fs.writeFile(lockerFilePath, updatedContent, 'utf8');
    console.log(`\n\u2705 Project ${absoluteRootPath} unlocked.`);
  } catch (e) { console.error('\u274C Error during unlock:', e); }
}

/**
 * Uninstalls the locker interceptor by removing it from the shell RC and deleting its files.
 */
async function handleUninstall(configFile, rl) {
  const configContent = await fs.readFile(configFile, 'utf8').catch(() => '');
  const sourceMatch = configContent.match(/source\s+(['"])(.*?)\1\s*$/m) || configContent.match(/source\s+([^\s\n\r]+)\s*$/m);
  
  let lockerFilePath = null;
  if (sourceMatch) {
    const pathCandidate = sourceMatch[2] || sourceMatch[1];
    if (pathCandidate && pathCandidate.includes('container-locker.sh')) {
      lockerFilePath = pathCandidate;
    }
  }

  if (!lockerFilePath) return console.error('\u274C No locker script found in config.');

  if (!SecurityPolicy.validateSafePath(lockerFilePath, true)) {
    return console.error(`\u274C The sourced locker path is invalid or unsafe: ${lockerFilePath}`);
  }

  const lockerDir = path.dirname(lockerFilePath);

  try {
    const content = await fs.readFile(lockerFilePath, 'utf8');
    const bins = ShellParser.parseBinaries(content);

    await fs.access(lockerFilePath);
    await fs.unlink(lockerFilePath);

    const sourceLine = `source ${LockerGenerator.shellSingleQuote(lockerFilePath)}`;
    const escapedSourceLine = sourceLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await fs.writeFile(configFile, configContent.replace(new RegExp(`^\\s*${escapedSourceLine}\\s*$`, 'gm'), '').trim() + '\n', 'utf8');

    try {
      await fs.rmdir(lockerDir);
    } catch (e) {
       console.warn(`\u275C Locker directory ${lockerDir} was not empty, so it was preserved.`);
    }

    console.log('\n\u2705 Uninstall complete!');
    if (bins.length > 0) {
      console.log(`\nTo apply changes immediately, you can run:\n   unset -f ${bins.join(' ')}`);
      console.log(`\nAlternatively, simply restart your terminal session.`);
    }
  } catch (e) { console.error('\u274C Uninstall failed: Could not verify or remove locker script.'); }
}


if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  //Immediately call setup if the script is invoked, unless it's invoked by a test.
  setup();
}

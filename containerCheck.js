import fs from 'node:fs';

export function isRunningContainer() {
  if (process.env.IS_CONTAINER === 'true') return true;
  return false;
}

export async function assertContainer() {

  const isPrecheck = process.argv.includes("--source=precheck")
  const isSetupCommand = process.argv.some(arg => ['lock', 'unlock', 'uninstall'].includes(arg))
  const source = isPrecheck ? " Process stopped at the pre-script boundary.": ""

  if(!isRunningContainer() && !isSetupCommand) {
    throw new Error("\u274C " + `Error: Application must be run inside a container.${source}`)
  }
}


await assertContainer()
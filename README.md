# Code Execution Guardrail

Dev Containers help maintain isolation of code, which is especially important when accounting for agentic workflows. However, because coding workflows in particular tend to use bind-mounted filesystems, it's easy for a developer to inadvertently execute code that should only be run inside a container on the host system.

This repository contains a minimal reference pattern for enforcing a container execution boundary for binary execution unless the code verifies that it's running inside a container. It is designed as an operational safety rail for developers, not a zero-trust environment.

The code utilizes a **defense-in-depth** approach:
* A shell-level script that blocks binaries such as `npm` and `node` at the shell level
* A demonstration pre-script hook that stops execution of the command pipeline if a binary is successfully invoked
* A container check via NODE_OPTIONS so that it executes prior to the entrypoint
* A code-level fallback that executes prior to the rest of the codebase via direct import

| | Shell | Package-Level Hooks | NODE_OPTIONS | Direct Import
| -- | --- | --------------- | --------------  | --------------
| Strength | Blocks execution of specifically named binaries via interactive shell | Blocks execution of npm commands such as install |	Blocks execution of code via import before bundler reordering | Blocks execution of code directly
| Weakness | Indirect execution via other commands allowed; does not block non-interactive shells | Requires code hygiene to instrument all commands; `npx` bypasses package-level scripts | Does not block package installation, pre- and post-install scripts, requires environment variable propagation, and can be bypassed by running files directly if injected in package.json | Does not block package installation, pre- and post-install scripts, requires direct import in every entrypoint, other imports in ESM modules that execute top-level side effects may still run

Note that each layer is intended to be defense-in-depth because no single layer provides complete coverage against accidental execution. Additionally, the combined layers are not intended to ensure a zero-trust environment.

## Prerequisites
* An environment variable, IS_CONTAINER must be passed into the dev container environment via devcontainer.json:
```
"containerEnv": {
    "IS_CONTAINER": "true"
  }
```
## Shell Script

The `/shell` directory contains code that executes in response to the `package.json` `setup` commands.

There are three commands:
* setup:lock (installs, if necessary, and locks a directory)
* setup:unlock (unlocks only)
* setup:uninstall (removes the utility)

The `setup:lock` command in `package.json` specifies a list of binaries that are blocked.

On installation, a shell script is created in the user-specifiable installation directory that specifies shell functions to override the specified binaries.

The command also adds a `source` command to the user's `.bashrc` or `.zshrc` file to include the script.

At the shell level, the approach tracks directories that are "locked" and prevents host-side execution in the shell.

## Container Check
At the package and code level blocks, `containerCheck.js` determines if there's a container environment variable to determine whether code is running inside a container.

If a container is not detected, then an error is thrown. The container check is utilized for determining if the shell is running in a container, for the package-level hook intercepts, and for the code level fallback. Because this utility is intended to be used
with dev containers, it's unnecessary to search for container markers.

## Pre-Script Hooks & Runtime Check

At the package.json script level, the `containerCheck.js` file is executed before commands such as install and dev via "preinstall" or "predev". This approach blocks direct invocations of scripts via `npm`.

## NODE_OPTIONS

At the code level, as a fallback, `containerCheck.js` is run via `NODE_OPTIONS` import. At this level, the code is unable to prevent the underlying binaries from loading but can prevent downstream, interpreted code from executing. Additionally, it runs before bundlers reorder imports.

## Code-Level Fallback

As a fallback, `containerCheck.js` can be imported directly at the entry points. This check is difficult even for agents to avoid since it's not subject to workarounds such as indirect invocation. One note is that ESM may hoist and run modules in an order that bypasses the code-level check.

## ESM vs CJS
`NODE_OPTIONS` is set to `--import` due to the use of modules set in the TypeScript `tsconfig.json`. For CJS, `--require` can be utilized instead.

## Cross Platform Considerations
Note that an approach for NODE_OPTIONS that's compatible across operating systems would require additional development, for example via a library similar to cross-env or a different approach to setting the `NODE_OPTIONS` environment variable.

## Additional Security Considerations

Shimming binaries or utilizing DIRENV would likely provide a more robust approach to preventing accidental execution but the complexity level is higher and DIRENV requires managing an external dependency and introduces additional security risks. 

This reference repository does **not** create an isolated, zero-trust environment.
# Node 24 migration implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded runtime change. Owner explicitly requested planning and execution; the ongoing website implementation continues in parallel.

**Goal:** Make Node24 LTS the project's declared, tested local/build/server runtime.

**Architecture:** Change runtime declarations and developer instructions, preserve locked application dependencies, and verify the existing Astro/Vercel application on Node24. Use a portable official Node24 runtime in the authorized workspace for checks; the owner may update their global Windows installation.

**Tech stack:** Node24 LTS, Astro6.1.7, Svelte5, Vercel server adapter, native Node tests.

**Spec:** Owner request on13 October2026: switch toNode24, plan and implement, teach an easy owner task. Existing website integration spec remains authoritative for application behavior.

## Global constraints

- Preserve Copilot design and all existing work; no automatic commit, deployment, live transaction or production migration.
- Application dependency versions remain locked. package.json engines and package-lock root engines become24.x.
- .nvmrc declares24. Remove ASTRO_DISABLE_NODE_VERSION_CHECK from dev/build scripts so normal Astro compatibility checks apply.
- README, AGENTS and current setup guide describeNode24. Historical test evidence remains datedNode22 evidence.
- Root owns the runtime changes; Wal continues the existing customer/admin task without changing package manifests.

## Review focus

- Native test flags and TypeScript stripping must work on24: run the real full suite.
- Native build dependencies must load on24: run Astro diagnostics and production packaging.
- Vercel output must declare24.x from the project engines: inspect generated function configuration.
- Existing checkout/auth/booking UI must still render: keep rendered verification in the final website pass.
- Stale22 instructions must not direct future installs: search active setup/config files and update them, preserving historical logs.

### Task1: Runtime declarations and local verification

**Files:** Modify package.json, package-lock.json, README.md, AGENTS.md, docs/integration-setup.md; create .nvmrc. Record results in the integration progress ledger.

- [x] Obtain latest official24.x Windowsx64 portable runtime; verify its SHA256 against official SHASUMS.
- [x] Set project/lock root engines to24.x and .nvmrc to24; remove the Astro version-check bypass from dev/build. Confirm the remaining dependency entries are unchanged.
- [x] Update active instructions toNode24. Owner task: install/updateNode24 LTS through nodejs.org, reopen terminal, verify node -v and npm -v. Do not require the owner to edit source files.
- [ ] Run full native tests, Astro check and production build on24 after Wal's integrated source is ready; inspect Vercel function runtime and restart local preview on24. Expected tests0fail, diagnostics0errors, buildComplete, runtime nodejs24.x.
- [ ] Synchronize scoped changes to authoritativeD checkout, review file hashes/current source and record exact results/remaining external-service prerequisites.

Official support references: Node release schedule https://github.com/nodejs/Release (24 support through30April2028), Astro installation https://docs.astro.build/en/install-and-setup/ (>=22.12), Vercel versions https://vercel.com/docs/functions/runtimes/node-js/node-js-versions (24.x supported). No compatibility result is claimed until commands pass.

Runtime obtained: official node-v24.21.0-win-x64.zip, SHA256158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541 verified against official latest-v24.x/SHASUMS256.txt. Portable executable reports v24.21.0. Owner global executable reports v24.15.0. Application packages remain locked; full integrated compatibility checks are pending.

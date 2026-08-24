# Meticulous Dial machine packages

This directory preserves the reusable, Dial-only packaging workflow first used
for the Free Pour test build. It creates a self-contained package with:

- an ARM64 `meticulous-dial` binary;
- guarded install and rollback scripts;
- a log collector;
- build metadata and SHA-256 checksums.

The installer is deliberately limited to `/usr/bin/meticulous-dial`. It does
not install firmware or backend packages and does not write to the history
database. Before replacement it checks the package, machine identity, firmware,
idle state, services, settings endpoint, disk space, and binary architecture.
It then makes verified backups on both the machine and the Mac. Installation
requires a typed confirmation and automatically restores the previous Dial if
startup or verification fails.

## Create a package

First build the ARM64 Dial binary. Then run:

```bash
./scripts/machine-package/make-dial-package.sh \
  --artifact src-tauri/target/aarch64-unknown-linux-gnu/release/meticulous-dial \
  --output-dir /path/to/package \
  --name my-dial-build \
  --expected-firmware 0.2.24-000-g0000000 \
  --test-plan scripts/machine-package/test-plans/pourover-improvements.md
```

Run the generated package's installer with `--preflight-only` before allowing
any machine changes. `TARGET`, `EXPECTED_SERIAL`, `EXPECTED_FIRMWARE`, and
`LOCAL_BACKUP_ROOT` can be overridden in the environment when the package is
used with a different explicitly verified machine state.

## Provenance

The safety sequence is generalized from the local
`free-pour-test-cfa4a2c` package: exact package hashes, ARM64 validation,
machine and firmware pinning, idle checks, a Dial-only dual backup, typed
confirmation, settings invariance checks, and automatic restoration.

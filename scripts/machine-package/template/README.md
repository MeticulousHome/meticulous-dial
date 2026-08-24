# Meticulous Dial test package

This is a guarded, Dial-only package. Read `PACKAGE.conf` and
`BUILD-MANIFEST.md` for the exact build identity.

## Safe sequence

1. Verify the package locally:
   `shasum -a 256 -c SHA256SUMS`
2. With the machine powered on and idle, run:
   `./install-dial-build.sh --preflight-only`
3. Review the reported machine, firmware, current Dial hash, and test hash.
4. Run `./install-dial-build.sh` and type the exact confirmation only when
   ready to install.
5. Perform the feature tests supplied with the package handoff.
6. Save diagnostics with `./collect-machine-logs.sh`.
7. If necessary, restore the exact prior Dial with
   `./rollback-dial-build.sh`.

The installer changes only `/usr/bin/meticulous-dial` and restarts only
`meticulous-dial.service`. It does not replace firmware or backend packages and
does not migrate or edit the history database. It creates verified backups on
the machine and Mac before installation and restores automatically if the new
Dial fails its startup checks.

Environment overrides: `TARGET`, `EXPECTED_SERIAL`, `EXPECTED_FIRMWARE`,
`LOCAL_BACKUP_ROOT`, and (for log collection) `SINCE`.


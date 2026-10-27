# Meticulous Dial

The UI on the Meticulous espresso machine's round display, in Qt Quick 6.4
(Debian bookworm), drawing straight on DRM/KMS. The app is in `qt/`: the C++
host in `qt/src`, the UI in `qt/qml`. It ships as the arm64 package
`meticulous-dial`, which meticulous-machine builds and installs in the image.

- Build, run on a PC, deploy to a machine, package:
  [docs/qt-migration/README.md](docs/qt-migration/README.md)
- The checks every pull request runs, and where a new test goes: [AGENTS.md](AGENTS.md)
- Tests in detail: [docs/qt-migration/TESTING.md](docs/qt-migration/TESTING.md)
- Why Qt and how the app is built: [docs/qt-migration/DECISIONS.md](docs/qt-migration/DECISIONS.md)

Everything builds in Docker from Linux or WSL:

```bash
bash qt/scripts/build.sh          # qt/build/amd64 and qt/build/arm64
bash qt/scripts/package-deb.sh    # qt/build/meticulous-dial_<version>_arm64.deb
```

## Commits and releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
(`type(scope): subject`, checked by commitlint; `npm run commit` asks for each
part). semantic-release sets the release version in `package.json` on `beta`
and `master`; the Dial and its package take their version from there.
`npm install` once sets up the commit hook (husky).

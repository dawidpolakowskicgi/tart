# CGI Worktrace

![CI](https://github.com/dawidpolakowskicgi/cgi-worktrace/actions/workflows/tests.yml/badge.svg)
![Release](https://img.shields.io/github/v/release/dawidpolakowskicgi/cgi-worktrace)
![License](https://img.shields.io/github/license/dawidpolakowskicgi/cgi-worktrace)

`CGI Worktrace` is a lightweight command-line tool and desktop app for logging task activity.

It is open source under the MIT License.

It keeps the daily workflow fast, while presenting a more predictable CLI surface:

* command-based interface
* backwards-compatible quick logging
* file-based storage
* human-readable weekly logs
* strict date and ISO week validation
* configurable log directory

## Desktop App Screenshot

![CGI Worktrace desktop app screenshot](./src/Screenshot.png)

The image above shows the current Electron desktop app layout for `CGI Worktrace`.
It uses a full-width top chrome, a left workspace panel, separate date and time controls for new entries, week filtering, inline editing, copy/export actions, and row-level task actions.

The desktop UI is also covered by automated renderer and core tests, so the screenshot stays in step with the app structure.

## Installation

### Linux

```bash
curl -fsSL https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/install.sh | bash
```

### macOS

```bash
curl -fsSL https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/install-macos.sh | bash
```

The macOS installer puts the CLI in:

```text
~/.local/bin/worktrace
```

Add this to `~/.zshrc` or `~/.zprofile` if you want to run `worktrace` from any shell:

```zsh
export PATH="$HOME/.local/bin:$PATH"
```

It also installs the desktop app in:

```text
~/Applications/CGI Worktrace.app
```

The desktop app support files live in:

```text
~/Library/Application Support/worktrace
```

The desktop app needs Node.js and npm so the installer can install Electron dependencies. The CLI works without Node.js.

Install from a local clone:

```bash
git clone https://github.com/dawidpolakowskicgi/cgi-worktrace.git
cd worktrace
./scripts/install-macos.sh
```

Choose another CLI install directory:

```bash
WORKTRACE_INSTALL_DIR="$HOME/bin" ./scripts/install-macos.sh
```

Choose another desktop app directory:

```bash
WORKTRACE_MACOS_APP_DIR="$HOME/Desktop" ./scripts/install-macos.sh
```

### Linux Details

The shell installer puts `worktrace` in:

```text
~/.local/bin/worktrace
```

Add this to `~/.zshrc` or `~/.zprofile` if you want to run `worktrace` from any shell:

```zsh
export PATH="$HOME/.local/bin:$PATH"
```

If `~/.local/bin` is not already in your `PATH`, the installer prints the exact line to add to your shell profile.

If you want a simple desktop launcher alias in zsh, add:

```zsh
alias worktrace-desktop='cd /path/to/worktrace && npm run desktop'
```

Install from a local clone:

```bash
git clone https://github.com/dawidpolakowskicgi/cgi-worktrace.git
cd worktrace
./scripts/install.sh
```

Choose another install directory:

```bash
WORKTRACE_INSTALL_DIR="$HOME/bin" ./scripts/install.sh
```

### Windows

Install Git for Windows first, because `worktrace` runs through Git Bash on Windows.

Then run this in PowerShell:

```powershell
irm https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/install.ps1 | iex
```

The installer puts `worktrace` in:

```text
%LOCALAPPDATA%\worktrace\bin
```

It also adds that directory to your user `PATH`. Open a new terminal after installation, then run:

```powershell
worktrace version
```

Install from a local clone:

```powershell
git clone https://github.com/dawidpolakowskicgi/cgi-worktrace.git
cd worktrace
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

### Release Downloads

Latest release assets:

* [Shell installer](https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/install.sh)
* [macOS installer](https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/install-macos.sh)
* [PowerShell installer](https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/install.ps1)
* [Linux archive](https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/worktrace-linux.tar.gz)
* [macOS archive](https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/worktrace-macos.tar.gz)
* [Windows archive](https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/worktrace-windows.zip)

The release archives include the CLI, the Electron desktop app source, installer scripts, and launcher assets.

## Project Docs

- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)

## Project Base

Create a new Electron desktop project scaffold based on `worktrace`:

```bash
./scripts/create-project-base.sh "Focus Journal"
```

By default, the generator writes to `./focus-journal`. You can also choose the output directory explicitly:

```bash
./scripts/create-project-base.sh "Client Notes" /tmp/client-notes
```

Project names may include letters, numbers, spaces, dots, underscores, and hyphens.

The generated base includes:

* Electron main, preload, renderer, HTML, and CSS files
* tray or menu-bar behavior
* a weekly file-backed activity store under `~/Documents/<project-slug>`
* starter icons copied from CGI Worktrace
* a minimal `package.json`, `.gitignore`, and README
* `electron` as the only starter dev dependency

After generation:

```bash
cd focus-journal
npm install
npm run desktop
```

You can also use the generated `README.md` inside the scaffold as a quick checklist for the first customization steps.

## Usage

Show the current week's log:

```bash
worktrace
worktrace list
```

Add a task entry:

```bash
worktrace add "implemented login feature"
```

Quick logging is still supported:

```bash
worktrace "implemented login feature"
```

Show today's entries:

```bash
worktrace today
worktrace --today
```

Show a specific week:

```bash
worktrace week 2026-04-30
worktrace list --week 2026-W18
```

Print the resolved log path:

```bash
worktrace path
worktrace path 2026-W18
```

Show configuration:

```bash
worktrace config
```

## Desktop Launcher

Install desktop dependencies:

```bash
npm install
```

Run the Electron desktop app:

```bash
npm run desktop
# or
./worktrace-desktop
```

The desktop app provides:

```text
Add entry with date, time, optional task project, and optional ticket or link reference
Week, today, and raw weekly editor views
Week filtering with selectable week, from, and to fields
Export week as TXT, CSV, or PDF
Open log directory
```

Notes:

* it uses the same file format as the CLI
* it reads `WORKTRACE_LOGDIR` when set
* it stores logs in `~/Documents/worktrace` by default
* it keeps a tray or menu bar icon active, and minimize or close hides the window there
* use the tray menu to show the app, open the log directory, or quit
* it requires Node.js and Electron dependencies installed with `npm install`

## Desktop Testing

The repository includes automated coverage for the desktop app:

* `tests/test_desktop_core.mjs` checks the app core data model and weekly log behavior
* `tests/test_desktop_renderer.mjs` checks renderer interactions and UI state updates
* `tests/run.sh` runs the desktop smoke checks, including the scaffold generator and desktop asset checks

If you update the desktop UI or the screenshot, run the test suite and refresh `src/Screenshot.png` so the README matches the current app.

Regenerate native desktop icons from the cake-clock source image:

```bash
npm run icons
```

## Commands

```text
worktrace add <message...>             Add a task entry for today
worktrace list [--week <ref>]          Show entries for a week
worktrace today                        Show today's entries
worktrace week [<ref>]                 Show entries for the week containing <ref>
worktrace path [<ref>]                 Print the log file path for a week
worktrace init                         Create the log directory
worktrace config                       Show resolved configuration
worktrace version                      Show version
worktrace help                         Show help
```

Legacy aliases are still available:

```text
worktrace -t | --today
worktrace -tw | --this-week
worktrace --week <ref>
```

## Week References

Week commands accept either:

```text
YYYY-MM-DD
YYYY-Www
```

Date references can be any date in the target week. `worktrace` resolves them to the Monday log file for that ISO week.

Examples:

```bash
worktrace week 2026-04-30
worktrace week 2026-W18
```

Both resolve to:

```text
2026-04-27.log
```

## Configuration

Default log directory:

```bash
~/Documents/worktrace
```

Override it for your shell:

```bash
export WORKTRACE_LOGDIR="$HOME/somewhere/worktrace"
```

Override it for one command:

```bash
worktrace --log-dir "$HOME/tmp/worktrace" add "tested release candidate"
```

## Data Format

Each week is stored in its own file, named after the Monday of that week:

```text
2026-04-27.log
```

Entries are plain text. CLI entries are date-based, and desktop entries include time when present:

```text
YYYY-MM-DD <message>
```

Example:

```text
2026-04-27 implemented login feature
2026-04-28 fixed auth bug
2026-04-30 reviewed API changes
```

## Development

Run the test suite:

```bash
npm test
```

The tests include Bash CLI regression tests and Node tests for the Electron desktop core. They use isolated temporary log directories and pin the current date with `WORKTRACE_TODAY`.

## Philosophy

`CGI Worktrace` tracks what you did, not how long it took.

It is intentionally small, dependency-free, and easy to inspect, but the command surface is structured enough to feel reliable in day-to-day professional use.

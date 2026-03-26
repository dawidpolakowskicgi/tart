# tart

`tart` is a lightweight CLI tool for logging task activity.

It is designed to be fast, simple, and predictable:

- no dependencies
- file-based storage
- human-readable logs
- minimal friction for daily use

## What it does

- `tart` → shows the current week's log
- `tart "message"` → appends a task entry for today
- `tart --today` → shows today's entries
- `tart --week YYYY-Www` → shows a specific ISO week

## Installation

### 1) Clone the repository

```bash
git clone https://github.com/dawidpolakowskicgi/tart.git
cd tart
```

### 2) Make the script executable

```bash
chmod +x tart.sh
```

### 3) Install it somewhere on your PATH

A simple option is to copy it into `~/bin`:

```bash
mkdir -p ~/bin
cp tart.sh ~/bin/tart
```

You can also place it anywhere else that is already on your PATH.

### 4) Add `~/bin` to your `~/.zshrc`

If `~/bin` is not already on your PATH, add this line to `~/.zshrc`:

```bash
export PATH="$HOME/bin:$PATH"
```

Then reload your shell:

```bash
source ~/.zshrc
```

## Usage

Show the current week's log:

```bash
tart
```

Add a new entry:

```bash
tart "implemented login feature"
```

Show today's entries:

```bash
tart --today
```

Show a specific week:

```bash
tart --week 2026-W13
```

Show help:

```bash
tart --help
```

## Logs

By default, logs are stored in:

```bash
~/Documents/tart
```

You can change that by setting `TART_LOGDIR` before running the script:

```bash
export TART_LOGDIR="$HOME/somewhere/tart"
```

Each week is stored in its own file:

```bash
YYYY-Www.log
```

Each entry is written as:

```bash
YYYY-MM-DD <message>
```

## Example

```bash
2026-03-23 implemented login feature
2026-03-24 fixed auth bug
2026-03-24 reviewed API changes
```

## Philosophy

`tart` tracks what you did, not how long it took.

It is meant to be a tiny internal tool that stays out of your way and makes review/reporting easier later.


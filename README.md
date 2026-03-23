# tart (task activity reporting tool)

a lightweight cli tool for logging and reviewing task activity.

---

## overview

tart is a simple command-line utility designed for quickly capturing what you worked on during the day.

it is not a time tracker — instead, it focuses on **task activity logging** and building a clear historical trail.

the cli command:

    tart

---

## features

- quick task logging from the terminal
- daily and weekly activity tracking
- simple file-based storage (no dependencies)
- easy to integrate into workflows and scripts
- lightweight and fast

---

## installation

clone the repository:

    git clone <your-repo-url>
    cd tart

make the script executable:

    chmod +x tart.sh

(optional) move it to your path:

    mv tart.sh ~/bin/tart

---

## usage

### show current period (e.g. week)

    tart

### log a task

    tart "implemented login feature"

### help

    tart --help

---

## configuration

by default, logs are stored in:

    ~/documents/tart

you can override this location using:

    export tart_logdir="$home/path/to/logs"

---

## example output

    2026-03-23 implemented login feature
    2026-03-23 fixed authentication bug
    2026-03-23 code review for api module

---

## philosophy

tart is built around a simple idea:

    track what you did, not how long it took.

it is intended to:
- reduce friction when logging work
- provide a clear activity history
- support reporting without overhead

---

## contributing

internal tool — adapt as needed for your team.

---

## license

private / internal use
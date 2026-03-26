#!/usr/bin/env bash
set -euo pipefail

# tart - Task Activity Reporting Tool
#
# Defaults:
#   TART_LOGDIR -> ~/Documents/tart
#
# Each week stored as: YYYY-Www.log
# Entry format: YYYY-MM-DD <message>

TART_LOGDIR="${TART_LOGDIR:-${HOME}/Documents/tart}"

ensure_tart_dirs() {
  mkdir -p "$TART_LOGDIR"
}

show_tart_help() {
  cat <<'EOF_HELP'
╭─ tart (Task Activity Reporting Tool)
│ Usage:
│   tart                        → View current week's log
│   tart "message"             → Log a task
│   tart --today | -t          → View today's entries
│   tart --this-week | -tw     → View current week
│   tart --week YYYY-Www       → View a specific ISO week
│   tart -h|--help             → Help
╰──────────────────────────────────────
EOF_HELP
}

get_week_file() {
  local week_ref="${1:-}"

  if [[ -n "$week_ref" ]]; then
    printf '%s.log\n' "$week_ref"
  else
    date +"%G-W%V.log"
  fi
}

current_week_path() {
  echo "$TART_LOGDIR/$(get_week_file)"
}

week_path_for() {
  local week_ref="$1"
  echo "$TART_LOGDIR/$(get_week_file "$week_ref")"
}

append_tart_entry() {
  local entry="$*"
  local file
  file="$(current_week_path)"

  printf '%s %s\n' "$(date +%F)" "$entry" >> "$file"
  printf '✓ %s\n' "$entry"
}

show_week_entries() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "No entries yet for this week."
    return
  fi

  cat "$file"
}

show_today_entries() {
  local file today
  file="$(current_week_path)"
  today="$(date +%F)"

  if [[ ! -f "$file" ]]; then
    echo "No entries yet for today."
    return
  fi

  grep -E "^${today} " "$file" || echo "No entries yet for today."
}

main() {
  ensure_tart_dirs

  case "${1:-}" in
    -h|--help|help|?)
      show_tart_help
      ;;
    --today|-t)
      show_today_entries
      ;;
    --this-week|-tw)
      show_week_entries "$(current_week_path)"
      ;;
    --week)
      if [[ -z "${2:-}" ]]; then
        echo "Usage: tart --week YYYY-Www" >&2
        exit 1
      fi
      show_week_entries "$(week_path_for "$2")"
      ;;
    "")
      show_week_entries "$(current_week_path)"
      ;;
    *)
      append_tart_entry "$*"
      ;;
  esac
}

main "$@"

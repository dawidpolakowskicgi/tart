#!/usr/bin/env bash
set -euo pipefail

# worktrace - CGI Worktrace
#
# Defaults:
#   WORKTRACE_LOGDIR -> ~/Documents/worktrace
#
# Each week is stored as: YYYY-MM-DD.log (the Monday of that ISO week)
# Entry format: YYYY-MM-DD <message>

readonly WORKTRACE_VERSION="0.3.0"
WORKTRACE_LOGDIR="${WORKTRACE_LOGDIR:-${HOME}/Documents/worktrace}"
WORKTRACE_ARGS=()
WORKTRACE_FORCE_ADD=0

print_usage() {
  cat <<'EOF_HELP'
worktrace - CGI Worktrace

Usage:
  worktrace [global options] [command] [arguments]

Quick use:
  worktrace                         Show the current week's log
  worktrace "message"               Add a task entry for today

Commands:
  add <message...>             Add a task entry for today
  list [--week <ref>]          Show entries for a week
  today                        Show today's entries
  week [<ref>]                 Show entries for the week containing <ref>
  path [<ref>]                 Print the log file path for a week
  init                         Create the log directory
  config                       Show resolved configuration
  version                      Show version
  help                         Show help

Week refs:
  YYYY-MM-DD                   Any date in the target week
  YYYY-Www                     ISO week, for example 2026-W18

Global options:
  --log-dir <path>             Override WORKTRACE_LOGDIR for this run
  -h, --help                   Show help
  -v, --version                Show version

Legacy aliases:
  -t, --today                  Same as: worktrace today
  -tw, --this-week             Same as: worktrace list
  --week <ref>                 Same as: worktrace week <ref>

Environment:
  WORKTRACE_LOGDIR                  Default: ~/Documents/worktrace
EOF_HELP
}

print_version() {
  printf 'worktrace %s\n' "$WORKTRACE_VERSION"
}

usage_error() {
  printf 'worktrace: %s\n' "$1" >&2
  printf "Run 'worktrace help' for usage.\n" >&2
  exit 2
}

require_no_args() {
  local command="$1"
  shift

  if (($# > 0)); then
    usage_error "${command} does not accept arguments"
  fi
}

is_help_flag() {
  case "${1:-}" in
    -h|--help) return 0 ;;
    *) return 1 ;;
  esac
}

maybe_print_help() {
  if (($# == 1)) && is_help_flag "$1"; then
    print_usage
    return 0
  fi

  return 1
}

ensure_worktrace_dirs() {
  mkdir -p "$WORKTRACE_LOGDIR"
}

today_date() {
  if [[ -n "${WORKTRACE_TODAY:-}" ]]; then
    date_is_valid "$WORKTRACE_TODAY" || usage_error "invalid WORKTRACE_TODAY: ${WORKTRACE_TODAY}"
    printf '%s\n' "$WORKTRACE_TODAY"
    return 0
  fi

  date +%F
}

is_date_literal() {
  [[ "${1:-}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]
}

is_iso_week_ref() {
  [[ "${1:-}" =~ ^[0-9]{4}-W[0-9]{2}$ ]]
}

offset_date() {
  local date_string="$1"
  local days="$2"
  local shifted gnu_modifier sign abs_days

  if ((days < 0)); then
    gnu_modifier="${days} days"
  else
    gnu_modifier="+${days} days"
  fi

  if shifted="$(date -d "${date_string} ${gnu_modifier}" +%F 2>/dev/null)"; then
    printf '%s\n' "$shifted"
    return 0
  fi

  sign="+"
  abs_days="$days"
  if ((days < 0)); then
    sign="-"
    abs_days=$((-days))
  fi

  date -j -v"${sign}${abs_days}d" -f "%F" "$date_string" +%F
}

date_is_valid() {
  local date_string="$1"
  local normalized

  is_date_literal "$date_string" || return 1
  normalized="$(offset_date "$date_string" 0 2>/dev/null)" || return 1

  [[ "$normalized" == "$date_string" ]]
}

weekday_number() {
  local date_string="$1"
  local dow

  if dow="$(date -d "$date_string" +%u 2>/dev/null)"; then
    printf '%s\n' "$dow"
    return 0
  fi

  date -j -f "%F" "$date_string" +%u
}

iso_week_for_date() {
  local date_string="$1"
  local iso_week

  if iso_week="$(date -d "$date_string" +%G-W%V 2>/dev/null)"; then
    printf '%s\n' "$iso_week"
    return 0
  fi

  date -j -f "%F" "$date_string" +%G-W%V
}

week_start_for_date() {
  local date_string="$1"
  local dow offset

  date_is_valid "$date_string" || return 1

  dow="$(weekday_number "$date_string")"
  offset=$((dow - 1))

  if ((offset == 0)); then
    printf '%s\n' "$date_string"
  else
    offset_date "$date_string" "$((-offset))"
  fi
}

week_start_for_iso_week() {
  local week_ref="$1"
  local iso_year iso_week iso_week_number jan4 jan4_dow first_monday week_start

  if [[ ! "$week_ref" =~ ^([0-9]{4})-W([0-9]{2})$ ]]; then
    return 1
  fi

  iso_year="${BASH_REMATCH[1]}"
  iso_week="${BASH_REMATCH[2]}"
  iso_week_number=$((10#${iso_week}))

  if ((iso_week_number < 1 || iso_week_number > 53)); then
    return 1
  fi

  jan4="${iso_year}-01-04"
  jan4_dow="$(weekday_number "$jan4")"
  first_monday="$(offset_date "$jan4" "$((1 - jan4_dow))")"
  week_start="$(offset_date "$first_monday" "$(((iso_week_number - 1) * 7))")"

  [[ "$(iso_week_for_date "$week_start")" == "$week_ref" ]] || return 1
  printf '%s\n' "$week_start"
}

week_start_from_ref() {
  local ref="${1:-}"

  if [[ -z "$ref" ]]; then
    ref="$(today_date)"
  fi

  if is_date_literal "$ref"; then
    week_start_for_date "$ref" || usage_error "invalid date: ${ref}"
    return 0
  fi

  if is_iso_week_ref "$ref"; then
    week_start_for_iso_week "$ref" || usage_error "invalid ISO week: ${ref}"
    return 0
  fi

  usage_error "invalid week reference: ${ref} (expected YYYY-MM-DD or YYYY-Www)"
}

log_file_for_week_start() {
  local week_start="$1"

  printf '%s/%s.log\n' "$WORKTRACE_LOGDIR" "$week_start"
}

log_file_for_week_ref() {
  local ref="${1:-}"
  local week_start

  week_start="$(week_start_from_ref "$ref")"
  log_file_for_week_start "$week_start"
}

append_worktrace_entry() {
  local entry="$*"
  local today week_start file

  if [[ -z "${entry//[[:space:]]/}" ]]; then
    usage_error "missing entry message"
  fi

  if [[ "$entry" == *$'\n'* || "$entry" == *$'\r'* ]]; then
    usage_error "entry message must be a single line"
  fi

  today="$(today_date)"
  week_start="$(week_start_from_ref "$today")"
  file="$(log_file_for_week_start "$week_start")"

  ensure_worktrace_dirs
  printf '%s %s\n' "$today" "$entry" >> "$file"
  printf 'Logged: %s %s\n' "$today" "$entry"
}

show_week_entries() {
  local ref="${1:-}"
  local week_start file

  week_start="$(week_start_from_ref "$ref")"
  file="$(log_file_for_week_start "$week_start")"

  if [[ ! -f "$file" ]]; then
    printf 'No entries yet for week %s.\n' "$week_start"
    return 0
  fi

  cat "$file"
}

show_today_entries() {
  local today file

  today="$(today_date)"
  file="$(log_file_for_week_ref "$today")"

  if [[ ! -f "$file" ]]; then
    printf 'No entries yet for today.\n'
    return 0
  fi

  grep -E "^${today} " "$file" || printf 'No entries yet for today.\n'
}

cmd_add() {
  if [[ "${1:-}" == "--" ]]; then
    shift
    append_worktrace_entry "$@"
    return 0
  fi

  if [[ "$WORKTRACE_FORCE_ADD" != "1" ]] && maybe_print_help "$@"; then
    return 0
  fi

  append_worktrace_entry "$@"
}

cmd_list() {
  local week_ref=""

  if maybe_print_help "$@"; then
    return 0
  fi

  while (($# > 0)); do
    case "$1" in
      --week)
        shift
        if [[ -z "${1:-}" ]]; then
          usage_error "missing value for --week"
        fi
        week_ref="$1"
        ;;
      --week=*)
        week_ref="${1#*=}"
        if [[ -z "$week_ref" ]]; then
          usage_error "missing value for --week"
        fi
        ;;
      *)
        usage_error "unexpected argument for list: $1"
        ;;
    esac
    shift
  done

  show_week_entries "$week_ref"
}

cmd_today() {
  if maybe_print_help "$@"; then
    return 0
  fi

  require_no_args "today" "$@"
  show_today_entries
}

cmd_week() {
  if maybe_print_help "$@"; then
    return 0
  fi

  if (($# > 1)); then
    usage_error "week accepts at most one reference"
  fi

  show_week_entries "${1:-}"
}

cmd_path() {
  if maybe_print_help "$@"; then
    return 0
  fi

  if (($# > 1)); then
    usage_error "path accepts at most one reference"
  fi

  log_file_for_week_ref "${1:-}"
}

cmd_init() {
  if maybe_print_help "$@"; then
    return 0
  fi

  require_no_args "init" "$@"
  ensure_worktrace_dirs
  printf 'Initialized worktrace log directory: %s\n' "$WORKTRACE_LOGDIR"
}

cmd_config() {
  local current_week current_file

  if maybe_print_help "$@"; then
    return 0
  fi

  require_no_args "config" "$@"
  current_week="$(week_start_from_ref)"
  current_file="$(log_file_for_week_start "$current_week")"

  printf 'version=%s\n' "$WORKTRACE_VERSION"
  printf 'log_dir=%s\n' "$WORKTRACE_LOGDIR"
  printf 'current_week=%s\n' "$current_week"
  printf 'current_file=%s\n' "$current_file"
}

cmd_help() {
  if maybe_print_help "$@"; then
    return 0
  fi

  require_no_args "help" "$@"
  print_usage
}

cmd_version() {
  if maybe_print_help "$@"; then
    return 0
  fi

  require_no_args "version" "$@"
  print_version
}

cmd_this_week() {
  if maybe_print_help "$@"; then
    return 0
  fi

  require_no_args "this-week" "$@"
  show_week_entries
}

parse_global_options() {
  while (($# > 0)); do
    case "$1" in
      --log-dir)
        shift
        if [[ -z "${1:-}" ]]; then
          usage_error "missing value for --log-dir"
        fi
        WORKTRACE_LOGDIR="$1"
        ;;
      --log-dir=*)
        WORKTRACE_LOGDIR="${1#*=}"
        if [[ -z "$WORKTRACE_LOGDIR" ]]; then
          usage_error "missing value for --log-dir"
        fi
        ;;
      --)
        shift
        WORKTRACE_FORCE_ADD=1
        WORKTRACE_ARGS=("$@")
        return 0
        ;;
      *)
        break
        ;;
    esac
    shift
  done

  WORKTRACE_ARGS=("$@")
}

main() {
  parse_global_options "$@"
  if ((${#WORKTRACE_ARGS[@]} > 0)); then
    set -- "${WORKTRACE_ARGS[@]}"
  else
    set --
  fi

  if [[ "$WORKTRACE_FORCE_ADD" == "1" ]]; then
    cmd_add "$@"
    return 0
  fi

  if (($# == 0)); then
    show_week_entries
    return 0
  fi

  local command="$1"
  shift

  case "$command" in
    -h|--help|help|\?)
      cmd_help "$@"
      ;;
    -v|--version|version)
      cmd_version "$@"
      ;;
    -t|--today)
      cmd_today "$@"
      ;;
    -tw|--this-week)
      cmd_this_week "$@"
      ;;
    --week)
      if [[ -z "${1:-}" ]]; then
        usage_error "missing value for --week"
      fi
      cmd_week "$@"
      ;;
    add|log)
      cmd_add "$@"
      ;;
    list|show)
      cmd_list "$@"
      ;;
    today)
      cmd_today "$@"
      ;;
    week)
      cmd_week "$@"
      ;;
    path)
      cmd_path "$@"
      ;;
    init)
      cmd_init "$@"
      ;;
    config|doctor)
      cmd_config "$@"
      ;;
    --*|-*)
      usage_error "unknown option: ${command}"
      ;;
    *)
      cmd_add "$command" "$@"
      ;;
  esac
}

main "$@"

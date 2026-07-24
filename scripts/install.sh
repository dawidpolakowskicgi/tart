#!/usr/bin/env bash
set -euo pipefail

WORKTRACE_RAW_URL="${WORKTRACE_RAW_URL:-https://raw.githubusercontent.com/dawidpolakowskicgi/worktrace/main/worktrace.sh}"
WORKTRACE_INSTALL_DIR="${WORKTRACE_INSTALL_DIR:-${HOME}/.local/bin}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
target="${WORKTRACE_INSTALL_DIR}/worktrace"

download_worktrace() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$WORKTRACE_RAW_URL" -o "$target"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$target" "$WORKTRACE_RAW_URL"
    return
  fi

  printf 'worktrace installer: curl or wget is required to download worktrace.sh\n' >&2
  exit 1
}

install_worktrace() {
  local local_source=""

  mkdir -p "$WORKTRACE_INSTALL_DIR"

  if [[ "$(basename "$script_dir")" == "scripts" && -f "${repo_root}/worktrace.sh" ]]; then
    local_source="${repo_root}/worktrace.sh"
  fi

  if [[ -f "$local_source" ]]; then
    cp "$local_source" "$target"
  else
    download_worktrace
  fi

  chmod 0755 "$target"
}

path_contains_install_dir() {
  case ":${PATH}:" in
    *":${WORKTRACE_INSTALL_DIR}:"*) return 0 ;;
    *) return 1 ;;
  esac
}

print_next_steps() {
  printf 'Installed worktrace to %s\n' "$target"

  if path_contains_install_dir; then
    printf 'Run: worktrace version\n'
    return
  fi

  printf '\n%s is not currently in your PATH.\n' "$WORKTRACE_INSTALL_DIR"
  printf 'Add this to your shell profile, then open a new terminal:\n\n'
  printf '  export PATH="%s:$PATH"\n\n' "$WORKTRACE_INSTALL_DIR"
  printf 'Or run worktrace directly with:\n\n'
  printf '  %s version\n' "$target"
}

install_worktrace
print_next_steps

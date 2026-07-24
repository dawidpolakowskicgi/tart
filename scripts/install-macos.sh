#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'worktrace macOS installer must be run on macOS.\n' >&2
  exit 2
fi

WORKTRACE_INSTALL_DIR="${WORKTRACE_INSTALL_DIR:-${HOME}/.local/bin}"
WORKTRACE_MACOS_APP_DIR="${WORKTRACE_MACOS_APP_DIR:-${HOME}/Applications}"
WORKTRACE_MACOS_SUPPORT_DIR="${WORKTRACE_MACOS_SUPPORT_DIR:-${HOME}/Library/Application Support/worktrace}"
WORKTRACE_MACOS_ARCHIVE_URL="${WORKTRACE_MACOS_ARCHIVE_URL:-https://github.com/dawidpolakowskicgi/worktrace/releases/latest/download/worktrace-macos.tar.gz}"
WORKTRACE_SKIP_DESKTOP="${WORKTRACE_SKIP_DESKTOP:-0}"
WORKTRACE_SKIP_NPM_INSTALL="${WORKTRACE_SKIP_NPM_INSTALL:-0}"

script_dir="$(pwd)"
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

repo_root="$(cd "${script_dir}/.." 2>/dev/null && pwd || pwd)"
stage_dir=""
package_source=""

cleanup() {
  if [[ -n "$stage_dir" && -d "$stage_dir" ]]; then
    rm -rf "$stage_dir"
  fi
}

trap cleanup EXIT

download_file() {
  local url="$1"
  local target="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$target"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$target" "$url"
    return
  fi

  printf 'worktrace macOS installer: curl or wget is required.\n' >&2
  exit 1
}

local_package_available() {
  [[ -f "${repo_root}/worktrace.sh" && -f "${repo_root}/package.json" && -d "${repo_root}/desktop" ]]
}

download_release_package() {
  local archive extracted

  stage_dir="$(mktemp -d)"
  archive="${stage_dir}/worktrace-macos.tar.gz"

  printf 'Downloading worktrace macOS package...\n'
  download_file "$WORKTRACE_MACOS_ARCHIVE_URL" "$archive"
  tar -xzf "$archive" -C "$stage_dir"

  extracted="$(find "$stage_dir" -mindepth 1 -maxdepth 1 -type d -name 'worktrace-*' -print | head -n 1)"
  if [[ -z "$extracted" || ! -d "$extracted" ]]; then
    printf 'worktrace macOS installer: release archive did not contain a worktrace package.\n' >&2
    exit 1
  fi

  package_source="$extracted"
}

resolve_package_source() {
  if local_package_available; then
    package_source="$repo_root"
    return
  fi

  download_release_package
}

install_cli() {
  mkdir -p "$WORKTRACE_INSTALL_DIR"
  cp "${package_source}/worktrace.sh" "${WORKTRACE_INSTALL_DIR}/worktrace"
  chmod 0755 "${WORKTRACE_INSTALL_DIR}/worktrace"
}

copy_file_if_exists() {
  local source="$1"
  local target="$2"

  if [[ -f "$source" ]]; then
    cp "$source" "$target"
  fi
}

copy_dir() {
  local source="$1"
  local target="$2"

  rm -rf "$target"
  cp -R "$source" "$target"
}

install_desktop_files() {
  mkdir -p "$WORKTRACE_MACOS_SUPPORT_DIR"

  copy_file_if_exists "${package_source}/README.md" "$WORKTRACE_MACOS_SUPPORT_DIR/"
  copy_file_if_exists "${package_source}/package.json" "$WORKTRACE_MACOS_SUPPORT_DIR/"
  copy_file_if_exists "${package_source}/package-lock.json" "$WORKTRACE_MACOS_SUPPORT_DIR/"
  cp "${package_source}/worktrace.sh" "$WORKTRACE_MACOS_SUPPORT_DIR/"
  cp "${package_source}/worktrace-desktop" "$WORKTRACE_MACOS_SUPPORT_DIR/"
  copy_dir "${package_source}/assets" "${WORKTRACE_MACOS_SUPPORT_DIR}/assets"
  copy_dir "${package_source}/desktop" "${WORKTRACE_MACOS_SUPPORT_DIR}/desktop"

  chmod 0755 "${WORKTRACE_MACOS_SUPPORT_DIR}/worktrace.sh" "${WORKTRACE_MACOS_SUPPORT_DIR}/worktrace-desktop"
}

install_desktop_dependencies() {
  if [[ "$WORKTRACE_SKIP_NPM_INSTALL" == "1" ]]; then
    printf 'Skipped desktop dependency install because WORKTRACE_SKIP_NPM_INSTALL=1.\n'
    return
  fi

  if ! command -v npm >/dev/null 2>&1; then
    printf 'npm was not found. The CLI is installed, but the desktop app needs Node.js and npm.\n' >&2
    printf 'After installing Node.js, run: cd "%s" && npm install\n' "$WORKTRACE_MACOS_SUPPORT_DIR" >&2
    return
  fi

  printf 'Installing desktop dependencies...\n'
  if [[ -f "${WORKTRACE_MACOS_SUPPORT_DIR}/package-lock.json" ]]; then
    (cd "$WORKTRACE_MACOS_SUPPORT_DIR" && npm ci)
  else
    (cd "$WORKTRACE_MACOS_SUPPORT_DIR" && npm install)
  fi
}

write_app_launcher() {
  local launcher="$1"

  {
    printf '#!/usr/bin/env bash\n'
    printf 'set -euo pipefail\n'
    printf 'export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"\n'
    printf 'WORKTRACE_SUPPORT_DIR=%q\n' "$WORKTRACE_MACOS_SUPPORT_DIR"
    printf 'exec "${WORKTRACE_SUPPORT_DIR}/worktrace-desktop" "$@"\n'
  } > "$launcher"
  chmod 0755 "$launcher"
}

write_info_plist() {
  local plist="$1"

  cat > "$plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>worktrace</string>
  <key>CFBundleExecutable</key>
  <string>worktrace</string>
  <key>CFBundleIconFile</key>
  <string>worktrace-clock-icon</string>
  <key>CFBundleIdentifier</key>
  <string>com.cgi.worktrace.desktop</string>
  <key>CFBundleName</key>
  <string>worktrace</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.2.0</string>
  <key>CFBundleVersion</key>
  <string>0.2.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST
}

create_app_bundle() {
  local app_bundle="${WORKTRACE_MACOS_APP_DIR}/worktrace.app"
  local contents="${app_bundle}/Contents"

  mkdir -p "${contents}/MacOS" "${contents}/Resources"
  write_app_launcher "${contents}/MacOS/worktrace"
  write_info_plist "${contents}/Info.plist"

  if [[ -f "${WORKTRACE_MACOS_SUPPORT_DIR}/assets/worktrace-clock-icon.icns" ]]; then
    cp "${WORKTRACE_MACOS_SUPPORT_DIR}/assets/worktrace-clock-icon.icns" "${contents}/Resources/worktrace-clock-icon.icns"
  fi
}

path_contains_install_dir() {
  case ":${PATH}:" in
    *":${WORKTRACE_INSTALL_DIR}:"*) return 0 ;;
    *) return 1 ;;
  esac
}

print_next_steps() {
  printf '\nInstalled worktrace CLI to %s\n' "${WORKTRACE_INSTALL_DIR}/worktrace"

  if ! path_contains_install_dir; then
    printf '\n%s is not currently in your PATH.\n' "$WORKTRACE_INSTALL_DIR"
    printf 'Add this to your shell profile, then open a new terminal:\n\n'
    printf '  export PATH="%s:$PATH"\n' "$WORKTRACE_INSTALL_DIR"
  fi

  if [[ "$WORKTRACE_SKIP_DESKTOP" != "1" ]]; then
    printf '\nInstalled worktrace desktop app to %s\n' "${WORKTRACE_MACOS_APP_DIR}/worktrace.app"
    printf 'Open it from Finder, or run:\n\n'
    printf '  open "%s"\n' "${WORKTRACE_MACOS_APP_DIR}/worktrace.app"
  fi

  printf '\nCheck the CLI with:\n\n'
  printf '  worktrace version\n'
}

resolve_package_source
install_cli

if [[ "$WORKTRACE_SKIP_DESKTOP" != "1" ]]; then
  install_desktop_files
  install_desktop_dependencies
  create_app_bundle
fi

print_next_steps

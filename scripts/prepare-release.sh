#!/usr/bin/env bash
set -euo pipefail

if (($# != 2)); then
  printf 'usage: %s <version-tag> <output-dir>\n' "${0##*/}" >&2
  exit 2
fi

readonly VERSION_TAG="$1"
output_dir_arg="$2"
readonly RELEASE_URL_BASE="https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/download/${VERSION_TAG}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
stage_dir="$(mktemp -d)"
package_root="${stage_dir}/worktrace-${VERSION_TAG}"

cleanup() {
  rm -rf "$stage_dir"
}

trap cleanup EXIT

mkdir -p "$output_dir_arg"
readonly OUTPUT_DIR="$(cd "$output_dir_arg" && pwd)"

mkdir -p "$OUTPUT_DIR" "$package_root/assets" "$package_root/desktop" "$package_root/scripts"

cp "${repo_root}/README.md" "$package_root/"
cp "${repo_root}/package.json" "$package_root/"
if [[ -f "${repo_root}/package-lock.json" ]]; then
  cp "${repo_root}/package-lock.json" "$package_root/"
fi
cp "${repo_root}/worktrace.sh" "$package_root/"
cp "${repo_root}/worktrace-desktop" "$package_root/"
cp "${repo_root}/scripts/install.sh" "$package_root/scripts/"
cp "${repo_root}/scripts/install-macos.sh" "$package_root/scripts/"
cp "${repo_root}/scripts/install.ps1" "$package_root/scripts/"
cp "${repo_root}/desktop/index.html" "$package_root/desktop/"
cp "${repo_root}/desktop/main.cjs" "$package_root/desktop/"
cp "${repo_root}/desktop/preload.cjs" "$package_root/desktop/"
cp "${repo_root}/desktop/renderer.cjs" "$package_root/desktop/"
cp "${repo_root}/desktop/styles.css" "$package_root/desktop/"
cp "${repo_root}/desktop/worktrace-core.cjs" "$package_root/desktop/"
cp "${repo_root}/assets/worktrace-icon.gif" "$package_root/assets/"
cp "${repo_root}/assets/worktrace-icon.png" "$package_root/assets/"
cp "${repo_root}/assets/worktrace-clock-icon.icns" "$package_root/assets/"
cp "${repo_root}/assets/worktrace-clock-icon.ico" "$package_root/assets/"
cp "${repo_root}/assets/worktrace-clock-icon.png" "$package_root/assets/"
cp "${repo_root}/assets/worktrace-icon-key.gif" "$package_root/assets/"
cp "${repo_root}/assets/worktrace-icon-key.png" "$package_root/assets/"

chmod 0755 "$package_root/worktrace.sh" "$package_root/worktrace-desktop" "$package_root/scripts/install.sh" "$package_root/scripts/install-macos.sh"

sed \
  "s|https://raw.githubusercontent.com/dawidpolakowskicgi/cgi-worktrace/main/worktrace.sh|${RELEASE_URL_BASE}/worktrace.sh|g" \
  "${repo_root}/scripts/install.sh" > "${OUTPUT_DIR}/install.sh"
chmod 0755 "${OUTPUT_DIR}/install.sh"

sed \
  "s|https://github.com/dawidpolakowskicgi/cgi-worktrace/releases/latest/download/worktrace-macos.tar.gz|${RELEASE_URL_BASE}/worktrace-macos.tar.gz|g" \
  "${repo_root}/scripts/install-macos.sh" > "${OUTPUT_DIR}/install-macos.sh"
chmod 0755 "${OUTPUT_DIR}/install-macos.sh"

sed \
  "s|https://raw.githubusercontent.com/dawidpolakowskicgi/cgi-worktrace/main/worktrace.sh|${RELEASE_URL_BASE}/worktrace.sh|g" \
  "${repo_root}/scripts/install.ps1" > "${OUTPUT_DIR}/install.ps1"

cp "${repo_root}/worktrace.sh" "${OUTPUT_DIR}/worktrace.sh"
chmod 0755 "${OUTPUT_DIR}/worktrace.sh"

tar -C "$stage_dir" -czf "${OUTPUT_DIR}/worktrace-${VERSION_TAG}-linux.tar.gz" "worktrace-${VERSION_TAG}"
cp "${OUTPUT_DIR}/worktrace-${VERSION_TAG}-linux.tar.gz" "${OUTPUT_DIR}/worktrace-linux.tar.gz"

tar -C "$stage_dir" -czf "${OUTPUT_DIR}/worktrace-${VERSION_TAG}-macos.tar.gz" "worktrace-${VERSION_TAG}"
cp "${OUTPUT_DIR}/worktrace-${VERSION_TAG}-macos.tar.gz" "${OUTPUT_DIR}/worktrace-macos.tar.gz"

(
  cd "$stage_dir"
  zip -qr "${OUTPUT_DIR}/worktrace-${VERSION_TAG}-windows.zip" "worktrace-${VERSION_TAG}"
)
cp "${OUTPUT_DIR}/worktrace-${VERSION_TAG}-windows.zip" "${OUTPUT_DIR}/worktrace-windows.zip"

(
  cd "$OUTPUT_DIR"
  shasum -a 256 \
    install.sh \
    install-macos.sh \
    install.ps1 \
    worktrace.sh \
    "worktrace-${VERSION_TAG}-linux.tar.gz" \
    "worktrace-${VERSION_TAG}-macos.tar.gz" \
    "worktrace-${VERSION_TAG}-windows.zip" \
    worktrace-linux.tar.gz \
    worktrace-macos.tar.gz \
    worktrace-windows.zip \
    > SHA256SUMS.txt
)

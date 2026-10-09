#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/workdir" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ "$1" != /* ]]; then
  echo "Workdir must be an absolute path" >&2
  exit 2
fi
workdir="$(realpath -m "$1")"
if [[ "$workdir" == "$repo_root" || "$workdir" == "$repo_root/"* ]]; then
  echo "Workdir must be an absolute path outside the Prism repository" >&2
  exit 2
fi

readarray -t pins < <(python3 - "$repo_root/chromium.lock.json" <<'PY'
import json, sys
lock = json.load(open(sys.argv[1], encoding="utf-8"))
print(lock["chromium_src"])
print(lock["depot_tools"])
print(lock["source"])
PY
)
chromium_pin="${pins[0]}"
tools_pin="${pins[1]}"
source_url="${pins[2]}"

mkdir -p "$workdir"
if [[ ! -d "$workdir/depot_tools/.git" ]]; then
  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$workdir/depot_tools"
fi
if [[ -n "$(git -C "$workdir/depot_tools" status --porcelain)" ]]; then
  echo "depot_tools has local changes; refusing to change revision" >&2
  exit 1
fi
git -C "$workdir/depot_tools" fetch origin "$tools_pin"
git -C "$workdir/depot_tools" checkout --detach "$tools_pin"
export DEPOT_TOOLS_UPDATE=0
export PATH="$workdir/depot_tools:$PATH"
"$workdir/depot_tools/ensure_bootstrap"

mkdir -p "$workdir/chromium"
cd "$workdir/chromium"
if [[ ! -f .gclient ]]; then
  gclient config --name src "$source_url"
elif ! grep -Fq "$source_url" .gclient; then
  echo "Existing .gclient points at a different source" >&2
  exit 1
fi
if [[ -d src/.git && -n "$(git -C src status --porcelain)" ]]; then
  echo "Chromium source has local changes; refusing to change revision" >&2
  exit 1
fi
gclient sync --revision "src@$chromium_pin" --no-history --nohooks
if [[ ! -d src/.git ]]; then
  echo "Chromium source checkout is missing" >&2
  exit 1
fi
actual="$(git -C src rev-parse HEAD)"
if [[ "$actual" != "$chromium_pin" ]]; then
  echo "Wrong Chromium revision: $actual" >&2
  exit 1
fi
gclient runhooks
echo "Pinned checkout ready: $workdir/chromium/src ($actual)"

#!/usr/bin/env bash
# Commit all changes, create tag, push branch + tag.
#
#   make pushandrelease MSG="why this release"
#   make pushandrelease MSG="why" TAG=v0.1.13
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="${MSG:-}"
TAG="${TAG:-}"

die() { echo "[pushandrelease] ERROR: $*" >&2; exit 1; }
log() { echo "[pushandrelease] $*"; }

if [[ -z "$MSG" ]]; then
  die "MSG is required. Example: make pushandrelease MSG=\"Add notifications\""
fi

latest_tag() {
  git tag -l 'v*' --sort=-v:refname | head -1
}

bump_patch() {
  local t="${1#v}"
  local major minor patch
  IFS=. read -r major minor patch <<< "$t"
  patch=$((patch + 1))
  echo "v${major}.${minor}.${patch}"
}

if [[ -z "$TAG" ]]; then
  prev="$(latest_tag)"
  if [[ -z "$prev" ]]; then
    TAG="v0.1.0"
    log "No existing v* tags — using $TAG"
  else
    TAG="$(bump_patch "$prev")"
    log "Next tag: $TAG (after $prev)"
  fi
fi

[[ "$TAG" == v* ]] || TAG="v${TAG}"

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null 2>&1; then
  die "tag ${TAG} already exists locally"
fi

if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  die "tag ${TAG} already exists on origin"
fi

branch="$(git branch --show-current)"
[[ -n "$branch" ]] || die "detached HEAD — checkout a branch first"

git add -A

if git diff --cached --quiet; then
  die "nothing to commit (working tree clean)"
fi

git commit -m "$MSG"
git tag "$TAG"

log "Pushing branch ${branch}..."
git push origin "HEAD:${branch}"

log "Pushing tag ${TAG}..."
git push origin "$TAG"

log "Done — ${TAG} pushed (GitHub Actions will build the release)"

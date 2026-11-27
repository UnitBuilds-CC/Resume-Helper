#!/usr/bin/env bash
# This repository is public. The tool is the product; the job search is not.
# Fails if anything that identifies the owner or an employer they applied to is tracked.
#
# The patterns below bracket their first letter on purpose: a guard that contained the literal strings would
# itself be the leak it is looking for, and would also match its own file.
set -euo pipefail

status=0
PII='[I]an [V]isser|[i]an@[u]nitbuilds|\+[2]64 ?81 ?350|[H]e[n]ties Bay'
CV_ARTIFACTS='[i]an_visser|_[C]V\.(md|pdf|docx)$|_[C]overLetter\.|_[A]nswers\.md$|^cv[-0-9v]*\.md$|^cv[0-9]+_draft'

echo "== tracked files that look like CV artifacts"
if git ls-files | grep -qiE "$CV_ARTIFACTS"; then
  echo "FAIL: a personal document is tracked"
  git ls-files | grep -iE "$CV_ARTIFACTS" | sed 's/^/    /'
  status=1
else
  echo "ok: none"
fi

echo "== personal identifiers inside tracked text"
if hits=$(git grep -I -l -E "$PII" -- . 2>/dev/null); then
  echo "FAIL: tracked content contains personal identifiers"
  echo "$hits" | sed 's/^/    /'
  status=1
else
  echo "ok: none"
fi

echo "== SQLite files committed to the repository"
if git ls-files | grep -qE '\.db$|\.db-wal$|\.db-shm$'; then
  echo "FAIL: SQLite files are tracked - the -wal holds recent writes and the data is personal"
  git ls-files | grep -E '\.db$|\.db-wal$|\.db-shm$' | sed 's/^/    /'
  status=1
else
  echo "ok: none"
fi

echo "== the bundled server must be built, not committed"
if git ls-files | grep -qE 'src-tauri/resources/server/index\.(cjs|js)$'; then
  echo "FAIL: a generated bundle is tracked - it goes stale against src/server silently"
  git ls-files | grep -E 'src-tauri/resources/server/index\.(cjs|js)$' | sed 's/^/    /'
  status=1
else
  echo "ok: none"
fi

if [ "$status" -eq 0 ]; then
  echo "==== privacy guard passed ===="
else
  echo "==== privacy guard FAILED ===="
fi
exit "$status"

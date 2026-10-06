#!/usr/bin/env bash
# Copies the slidesend brand assets this site uses from a commit of nxsflow/brand.
# Usage: site/scripts/sync-brand.sh <path to the brand repo> <commit>
# Record the commit in site/BRAND.md afterwards.
set -euo pipefail
brand=$1
commit=$2
site=$(cd "$(dirname "$0")/.." && pwd)
git -C "$brand" show "${commit}:tokens/slidesend.css" > "$site/src/brand/slidesend.css"
for file in \
  svg/slidesend-wordmark-dark.svg svg/slidesend-wordmark-light.svg \
  favicon/slidesend-favicon.svg favicon/slidesend-favicon-dark-32.png \
  favicon/slidesend-favicon-dark.ico favicon/slidesend-apple-touch-180.png \
  social/slidesend-social.png; do
  git -C "$brand" show "${commit}:logos/slidesend/${file}" > "$site/public/brand/$(basename "$file")"
done
echo "Copied the brand assets of ${commit}."

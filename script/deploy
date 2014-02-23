#!/usr/bin/env bash

set -x
set -e

# Deploys a directory to github.io by jamming it into the `gh-pages` branch.

if [ ! -d "$1" ]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

BUILD=$(cd "$1"; pwd) # resolve absolute path

SHA=$(git rev-parse HEAD)
ORIGIN=$(git config --get remote.origin.url)

WORKING=".deploy-$SHA"

# Clone into a tmp directory, where we can mess around with impunity
git clone . $WORKING
cd $WORKING

# Prepare pristine gh-pages branch
git branch -D gh-pages >/dev/null 2>&1 || true
git checkout --orphan gh-pages
git rm -rf .

# Commit deployable files
cp $BUILD/* .
git add -A

# Clobber remote gh-pages
git commit -m "Build $SHA"
git push -f $ORIGIN gh-pages

# Clean up
cd -
rm -rf $WORKING

#!/bin/bash

# Script to bump version across all files
# Usage: ./scripts/bump-version.sh 1.0.0

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.0"
    exit 1
fi

VERSION=$1

echo "Bumping version to $VERSION..."

# Update package.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json && rm package.json.bak

# Update Cargo.toml
sed -i.bak "s/^version = \".*\"/version = \"$VERSION\"/" src-backend/Cargo.toml && rm src-backend/Cargo.toml.bak

# Update tauri.conf.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-backend/tauri.conf.json && rm src-backend/tauri.conf.json.bak

# Update Info.plist
sed -i.bak "s/<string>.*<\/string><!-- VERSION -->/<string>$VERSION<\/string><!-- VERSION -->/" src-backend/Info.plist && rm src-backend/Info.plist.bak

echo "✅ Version bumped to $VERSION in all files"
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff"
echo "2. Commit: git commit -am \"chore: bump version to v$VERSION\""
echo "3. Tag: git tag -a v$VERSION -m \"Release v$VERSION\""
echo "4. Push: git push && git push --tags"

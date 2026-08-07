#!/usr/bin/env bash
set -e

mkdir -p ./bin
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
export PATH="$BIN_DIR:$PWD/bin:$PATH"

echo "==> Installing yt-dlp binary..."
curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./bin/yt-dlp
chmod +x ./bin/yt-dlp
cp ./bin/yt-dlp "$BIN_DIR/yt-dlp"

echo "==> Installing static ffmpeg..."
FFMPEG_TEMP=$(mktemp -d)
curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar -xJ -C "$FFMPEG_TEMP" --strip-components=1
mv "$FFMPEG_TEMP/ffmpeg" "$BIN_DIR/ffmpeg"
rm -rf "$FFMPEG_TEMP"
chmod +x "$BIN_DIR/ffmpeg"

echo "==> Installing Node.js v22 static binary (required by yt-dlp EJS)..."
mkdir -p ./bin/node
curl -sL https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz | tar -xJ -C "./bin/node" --strip-components=1
chmod +x ./bin/node/bin/node

echo "==> Verifying binary installations..."
./bin/yt-dlp --version
"$BIN_DIR/ffmpeg" -version | head -n 1
./bin/node/bin/node --version

echo "==> Compiling Dabar Rust Server..."
cargo build --release -p dabar-server

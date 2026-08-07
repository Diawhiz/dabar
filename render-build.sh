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

echo "==> Installing Node.js static binary..."
NODE_TEMP=$(mktemp -d)
curl -sL https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz | tar -xJ -C "$NODE_TEMP" --strip-components=1
mv "$NODE_TEMP/bin/node" "$BIN_DIR/node"
rm -rf "$NODE_TEMP"
chmod +x "$BIN_DIR/node"

echo "==> Verifying binary installations..."
./bin/yt-dlp --version
"$BIN_DIR/ffmpeg" -version | head -n 1
"$BIN_DIR/node" --version

echo "==> Compiling Dabar Rust Server..."
cargo build --release -p dabar-server

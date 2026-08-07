#!/usr/bin/env bash
set -e

BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
export PATH="$BIN_DIR:$PATH"

echo "==> Installing yt-dlp..."
curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$BIN_DIR/yt-dlp"
chmod +x "$BIN_DIR/yt-dlp"

echo "==> Installing static ffmpeg..."
FFMPEG_TEMP=$(mktemp -d)
curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar -xJ -C "$FFMPEG_TEMP" --strip-components=1
mv "$FFMPEG_TEMP/ffmpeg" "$BIN_DIR/ffmpeg"
rm -rf "$FFMPEG_TEMP"
chmod +x "$BIN_DIR/ffmpeg"

echo "==> Verifying binary installations..."
"$BIN_DIR/yt-dlp" --version
"$BIN_DIR/ffmpeg" -version | head -n 1

echo "==> Compiling Dabar Rust Server..."
cargo build --release -p dabar-server

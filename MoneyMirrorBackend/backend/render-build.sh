#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing Python dependencies..."
pip install -r requirements.txt

# Download and extract ffmpeg statically linked binary if not present
if [ ! -f "$HOME/ffmpeg/ffmpeg" ]; then
  echo "Downloading static ffmpeg..."
  mkdir -p $HOME/ffmpeg
  cd $HOME/ffmpeg
  curl -LO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
  tar -xf ffmpeg-release-amd64-static.tar.xz --strip-components=1
  rm ffmpeg-release-amd64-static.tar.xz
  echo "ffmpeg installed at $HOME/ffmpeg"
else
  echo "ffmpeg already installed."
fi

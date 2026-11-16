#!/bin/bash
# Normalise loudness for YouTube (-14 LUFS) without re-encoding the picture.
#   tools/finish.sh out/film.mp4 out/film_final.mp4
set -e
ffmpeg -nostdin -v error -y -i "$1" -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 "$2"
echo "wrote $2"

"""Assemble the README tour from screencast frames: python3 tour_webp.py <frames-dir> <out.webp>

Writes the animated WebP, plus <frames-dir>/seq.mjpeg resampled to a constant 30 fps for the WebM encode.
"""
import io
import json
import os
import sys

from PIL import Image, _webp

FPS = 30
work, target = sys.argv[1], sys.argv[2]
manifest = json.load(open(os.path.join(work, "frames.json")))
frames, end = manifest["frames"], manifest["end"]
start = frames[0]["t"]

# Keep the latest frame in each 1/FPS slot; the screencast emits only on change, so holds stay one long frame.
kept = {}
for frame in frames:
    kept[round((frame["t"] - start) * FPS)] = frame["file"]
slots = sorted(kept)

# Pillow's public save() needs every frame in memory at once, so frames stream into its WebP encoder directly.
width, height = Image.open(os.path.join(work, frames[0]["file"])).size
encoder = _webp.WebPAnimEncoder((width, height), 0xFF0B1A33, 0, False, 3, 30, False, False)
for slot in slots:
    image = Image.open(os.path.join(work, kept[slot])).convert("RGB")
    encoder.add(image.getim(), round(slot * 1000 / FPS), False, 72, 100, 4)
encoder.add(None, round((end - start) * 1000), False, 72, 100, 0)
with open(target, "wb") as handle:
    handle.write(encoder.assemble("", "", ""))

# Constant-rate JPEG stream for ffmpeg (Playwright's build reads only MJPEG pipes): each slot repeats until the next.
total = round((end - start) * FPS)
index, encoded = 0, {}
with open(os.path.join(work, "seq.mjpeg"), "wb") as stream:
    for number in range(total):
        while index + 1 < len(slots) and slots[index + 1] <= number:
            index += 1
        if index not in encoded:
            buffer = io.BytesIO()
            Image.open(os.path.join(work, kept[slots[index]])).convert("RGB").save(buffer, "JPEG", quality=97)
            encoded = {index: buffer.getvalue()}
        stream.write(encoded[index])

print(f"{len(frames)} captured, {len(slots)} kept, {(end - start):.1f} s, {os.path.getsize(target) / 1e6:.1f} MB")

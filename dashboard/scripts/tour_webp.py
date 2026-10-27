"""Assemble the README tour from screencast frames: python3 tour_webp.py <frames-dir> <out.webp>

Writes the animated WebP, plus <frames-dir>/seq.mjpeg resampled to a constant 30 fps for the WebM encode.
"""
import io
import json
import os
import sys

from PIL import Image, _webp

FPS = 30
SIZE = (1600, 900)  # the README width; frames are captured at 1080p and downsampled for sharper text
STEP_MS = 40  # thin motion to 25 fps in the WebP, but never drop a frame that is then held on screen
LIMIT = 9.5e6  # GitHub stops rendering README images inline at 10 MB
QUALITIES = (86, 82, 78, 74, 70)
work, target = sys.argv[1], sys.argv[2]
manifest = json.load(open(os.path.join(work, "frames.json")))
frames, end = manifest["frames"], manifest["end"]
start = frames[0]["t"]

# Keep the latest frame in each 1/FPS slot; the screencast emits only on change, so holds stay one long frame.
kept = {}
for frame in frames:
    kept[round((frame["t"] - start) * FPS)] = frame["file"]
slots = sorted(kept)

timeline, last = [], -STEP_MS
for index, slot in enumerate(slots):
    at = slot * 1000 / FPS
    held = (slots[index + 1] - slot) * 1000 / FPS if index + 1 < len(slots) else 1000
    if at - last < STEP_MS and held < STEP_MS:
        continue
    last = at
    timeline.append((round(at), kept[slot]))

# Downsample once to disk so each quality attempt only re-encodes.
small = os.path.join(work, "small")
os.makedirs(small, exist_ok=True)
for _, file in timeline:
    Image.open(os.path.join(work, file)).convert("RGB").resize(SIZE, Image.LANCZOS).save(os.path.join(small, file), "PNG", compress_level=1)


def encode(quality):
    # Pillow's public save() needs every frame in memory at once, so frames stream into its WebP encoder directly.
    encoder = _webp.WebPAnimEncoder(SIZE, 0xFF0D1013, 0, False, 3, 30, False, False)
    for at, file in timeline:
        encoder.add(Image.open(os.path.join(small, file)).getim(), at, False, quality, 100, 4)
    encoder.add(None, round((end - start) * 1000), False, quality, 100, 0)
    return encoder.assemble("", "", "")


for quality in QUALITIES:
    data = encode(quality)
    if len(data) <= LIMIT:
        break
with open(target, "wb") as handle:
    handle.write(data)

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

print(f"{len(frames)} captured, {len(timeline)} in WebP at quality {quality}, {(end - start):.1f} s, {len(data) / 1e6:.1f} MB")

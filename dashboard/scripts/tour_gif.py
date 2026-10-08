"""Assemble the README tour GIF from extracted frames: python3 tour_gif.py <frames-dir> <out.gif>"""
import glob
import sys

import numpy as np
from PIL import Image

frames = [Image.open(path).convert("RGB") for path in sorted(glob.glob(sys.argv[1] + "/f-*.png"))]

# One palette for the whole tour, sampled across scenes so light pages and the dark stage both keep their colors.
sample = frames[:: max(1, len(frames) // 24)]
sheet = Image.new("RGB", (sample[0].width, sample[0].height * len(sample)))
for index, frame in enumerate(sample):
    sheet.paste(frame, (0, index * frame.height))
palette = sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT)

# Store only the pixels that changed since the previous frame; index 255 is transparent.
indexed = [np.array(frame.quantize(palette=palette, dither=Image.Dither.NONE)) for frame in frames]
output = [Image.fromarray(indexed[0], "P")]
for previous, current in zip(indexed, indexed[1:]):
    output.append(Image.fromarray(np.where(current == previous, 255, current).astype("uint8"), "P"))
for image in output:
    image.putpalette(palette.getpalette())
output[0].save(sys.argv[2], save_all=True, append_images=output[1:], duration=125, loop=0, disposal=1, transparency=255, optimize=False)
print(f"{len(frames)} frames, {len(frames) / 8:.0f} s")

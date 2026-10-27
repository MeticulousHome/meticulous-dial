# strip.py OUT.png IN1.png IN2.png ...: the screenshots side by side at 200 px (run inside qt-dial-run).
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
size = 200
ims = [Image.open(f).convert("RGB").resize((size, size)) for f in files]
W = Image.new("RGB", ((size + 4) * len(ims), size), (40, 40, 40))
for i, im in enumerate(ims):
    W.paste(im, (i * (size + 4), 0))
W.save(out)

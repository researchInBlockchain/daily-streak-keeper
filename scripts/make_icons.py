"""Draws the extension icons (original artwork) into extension/icons/.
draw_icon() is also used by make_store_images.py."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"
S = 1024


def draw_icon():
    """The icon at 1024x1024, RGBA."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # vertical indigo -> violet gradient tile with rounded corners
    grad = Image.new("RGBA", (S, S))
    top, bot = (91, 91, 214), (124, 58, 237)
    for y in range(S):
        t = y / (S - 1)
        c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
        ImageDraw.Draw(grad).line([(0, y), (S, y)], fill=c)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([40, 40, S - 40, S - 40], radius=230, fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    # check mark
    d.line([(285, 540), (450, 700), (760, 345)], fill="white", width=118, joint="curve")
    for x, y in [(285, 540), (760, 345)]:
        d.ellipse([x - 59, y - 59, x + 59, y + 59], fill="white")
    # streak dot
    d.ellipse([750, 120, 900, 270], fill=(251, 176, 59, 255), outline="white", width=26)
    return img


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    big = draw_icon()
    for size in (16, 32, 48, 128):
        big.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")
    print("icons written to", OUT)

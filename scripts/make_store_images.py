"""Builds the store images in store/edge/ from the icon and the UI screenshots.

Inputs:  extension/icons (via make_icons.draw_icon), docs/img/popup-*.png, store/edge/raw/dash-*.png
         (raw shots come from scripts/screens/harness.html, see README)
Outputs: logo-300.png, promo-small-440x280.png, promo-large-1400x560.png, screenshot-1..5.png (1280x800)
Needs Pillow and the Segoe UI font (Windows); falls back to Pillow's default font elsewhere.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from make_icons import draw_icon

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store" / "edge"
RAW = OUT / "raw"
TOP, BOT = (91, 91, 214), (124, 58, 237)


def font(size, bold=False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    try:
        return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
    except OSError:
        return ImageFont.load_default(size)


def gradient(w, h):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for x in range(w):
        t = x / max(w - 1, 1)
        d.line([(x, 0), (x, h)], fill=tuple(round(TOP[i] + (BOT[i] - TOP[i]) * t) for i in range(3)))
    return img


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im, (0, 0), mask)
    return out


def paste_card(bg, card, xy, radius=22, shadow=28):
    card = rounded(card.convert("RGBA"), radius)
    sh = Image.new("RGBA", (card.width + shadow * 4, card.height + shadow * 4), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [shadow * 2, shadow * 2 + 12, shadow * 2 + card.width, shadow * 2 + card.height + 12],
        radius=radius, fill=(20, 10, 60, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(shadow))
    bg.paste(sh, (xy[0] - shadow * 2, xy[1] - shadow * 2), sh)
    bg.paste(card, xy, card)


def text_block(d, x, y, lines, max_w):
    """lines: [(text, font, fill, gap_after)], wrapped to max_w. Returns the next y."""
    for text, f, fill, gap in lines:
        line = ""
        for w in text.split():
            trial = f"{line} {w}".strip()
            if d.textlength(trial, font=f) <= max_w:
                line = trial
            else:
                d.text((x, y), line, font=f, fill=fill)
                y += f.size * 1.25
                line = w
        if line:
            d.text((x, y), line, font=f, fill=fill)
            y += f.size * 1.25
        y += gap
    return y


def hero_screenshot(name, popup_file, title, bullets):
    W, H = 1280, 800
    bg = gradient(W, H).convert("RGBA")
    d = ImageDraw.Draw(bg)
    icon = draw_icon().resize((72, 72), Image.LANCZOS)
    bg.paste(icon, (80, 96), icon)
    d.text((168, 108), "Daily Streak Keeper", font=font(34, True), fill="white")
    y = text_block(d, 80, 210, [(title, font(54, True), "white", 26)], 600)
    for b in bullets:
        d.ellipse([84, y + 14, 96, y + 26], fill=(251, 176, 59))
        y = text_block(d, 112, y, [(b, font(26), (236, 236, 252), 10)], 560)
    popup = Image.open(ROOT / "docs" / "img" / popup_file)
    popup = popup.resize((int(popup.width * 0.62), int(popup.height * 0.62)), Image.LANCZOS)
    paste_card(bg, popup, (W - popup.width - 90, (H - popup.height) // 2))
    bg.convert("RGB").save(OUT / name)


def plain_screenshot(name, raw_file):
    Image.open(RAW / raw_file).convert("RGB").resize((1280, 800), Image.LANCZOS).save(OUT / name)


def promo(name, w, h, with_popup):
    bg = gradient(w, h).convert("RGBA")
    d = ImageDraw.Draw(bg)
    s = int(h * 0.36)
    icon = draw_icon().resize((s, s), Image.LANCZOS)
    x = int(w * 0.07)
    lift = int(h * (0.16 if with_popup else 0.12))
    bg.paste(icon, (x, (h - s) // 2 - lift), icon)
    ty = (h - s) // 2 + s - lift + int(h * 0.06)
    big = font(int(h * (0.1 if with_popup else 0.13)), True)
    small = font(int(h * (0.055 if with_popup else 0.075)))
    d.text((x, ty), "Daily Streak Keeper", font=big, fill="white")
    d.text((x, ty + big.size * 1.2), "Keep your LeetCode streak, automatically", font=small, fill=(236, 236, 252))
    if with_popup:
        popup = Image.open(ROOT / "docs" / "img" / "popup-accepted.png")
        scale = (h * 0.86) / popup.height
        popup = popup.resize((int(popup.width * scale), int(popup.height * scale)), Image.LANCZOS)
        paste_card(bg, popup, (w - popup.width - int(w * 0.07), (h - popup.height) // 2), radius=18, shadow=20)
    bg.convert("RGB").save(OUT / name)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon().resize((300, 300), Image.LANCZOS).save(OUT / "logo-300.png")
    hero_screenshot("screenshot-1.png", "popup-accepted.png", "Never lose your LeetCode daily streak again",
                    ["Finds a working solution to the problem of the day",
                     "Tests it on the examples, then submits it",
                     "Runs on its own while your browser is open"])
    hero_screenshot("screenshot-2.png", "popup-ready.png", "Prefer to read it first? You decide.",
                    ["\"Ask me first\" mode tests the solution, then waits for you",
                     "One click to submit, or open it on LeetCode",
                     "Optional free AI backup for brand-new problems"])
    plain_screenshot("screenshot-3.png", "dash-today.png")
    plain_screenshot("screenshot-4.png", "dash-setup.png")
    plain_screenshot("screenshot-5.png", "dash-how.png")
    promo("promo-small-440x280.png", 440, 280, with_popup=False)
    promo("promo-large-1400x560.png", 1400, 560, with_popup=True)
    for f in sorted(OUT.glob("*.png")):
        with Image.open(f) as im:
            print(f"{f.name:28s} {im.size[0]}x{im.size[1]}")

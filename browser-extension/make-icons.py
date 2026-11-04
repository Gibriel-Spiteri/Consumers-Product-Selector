# Draws the Consumers Quote Helper icons from the Product Selector's own favicon (the orange shopping bag), so the
# extension looks like the site. Run after the favicon changes: python browser-extension/make-icons.py
# Needs Pillow (pip install pillow).
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
FAVICON = HERE.parent / "artifacts" / "product-selector" / "public" / "favicon.png"
OUT = HERE / "consumers-quote-helper" / "icons"

# Space around the bag, as a share of the icon: none at toolbar size, a little at the larger sizes.
MARGIN = {16: 0.0, 32: 0.03, 48: 0.04, 128: 0.05}


def icon(source: Image.Image, size: int) -> Image.Image:
    box = round(size * (1 - 2 * MARGIN[size]))
    scale = box / max(source.width, source.height)
    w, h = max(1, round(source.width * scale)), max(1, round(source.height * scale))
    bag = source.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(bag, ((size - w) // 2, (size - h) // 2), bag)
    return out


def main() -> None:
    source = Image.open(FAVICON).convert("RGBA")
    source = source.crop(source.getbbox())  # trim transparent edges so the bag fills the icon
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        icon(source, size).save(OUT / f"icon{size}.png", optimize=True)
    print("icons written to", OUT)


if __name__ == "__main__":
    main()

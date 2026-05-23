from __future__ import annotations

from pathlib import Path
import sys

from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path.home() / "Desktop" / "\u8f6f\u4ef6\u56fe\u6807.png"
BUILD = ROOT / "build"
ASSETS = ROOT / "src" / "assets"


def trim_alpha(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    return image.crop(bbox) if bbox else image


def source_icon(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    # The source image contains a watermark in the bottom-right corner.
    # Crop to the centered icon body before generating app assets.
    cropped = image.crop((240, 255, 1775, 1790))
    cropped = trim_alpha(cropped)
    icon = ImageOps.contain(cropped, (900, 900), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    canvas.alpha_composite(icon, ((1024 - icon.width) // 2, (1024 - icon.height) // 2))
    return canvas


def save_png(icon: Image.Image) -> None:
    BUILD.mkdir(exist_ok=True)
    ASSETS.mkdir(exist_ok=True)
    icon.save(BUILD / "icon.png")
    icon.resize((128, 128), Image.Resampling.LANCZOS).save(ASSETS / "typeup-mark.png")


def save_ico(icon: Image.Image) -> None:
    sizes = [16, 24, 32, 48, 64, 128, 256]
    icon.save(BUILD / "icon.ico", sizes=[(size, size) for size in sizes])
    icon.save(BUILD / "installerIcon.ico", sizes=[(size, size) for size in sizes])


def paste_center(base: Image.Image, overlay: Image.Image, center: tuple[int, int]) -> None:
    x = center[0] - overlay.width // 2
    y = center[1] - overlay.height // 2
    base.alpha_composite(overlay, (x, y))


def icon_shadow(icon: Image.Image, radius: int = 8, opacity: int = 60) -> Image.Image:
    alpha = icon.getchannel("A")
    shadow_alpha = alpha.point(lambda value: value * opacity // 255)
    shadow_alpha = shadow_alpha.filter(ImageFilter.GaussianBlur(radius))
    shadow = Image.new("RGBA", icon.size, (15, 38, 85, 0))
    shadow.putalpha(shadow_alpha)
    return shadow


def save_nsis_bitmaps(icon: Image.Image) -> None:
    header = Image.new("RGBA", (150, 57), (248, 251, 255, 255))
    header_icon = icon.resize((44, 44), Image.Resampling.LANCZOS)
    paste_center(header, icon_shadow(header_icon, 4, 40), (34, 30))
    paste_center(header, header_icon, (34, 29))
    header.convert("RGB").save(BUILD / "installerHeader.bmp")

    sidebar = Image.new("RGBA", (164, 314), (247, 250, 255, 255))
    sidebar_icon = icon.resize((110, 110), Image.Resampling.LANCZOS)
    paste_center(sidebar, icon_shadow(sidebar_icon, 8, 55), (82, 111))
    paste_center(sidebar, sidebar_icon, (82, 108))
    sidebar.convert("RGB").save(BUILD / "installerSidebar.bmp")


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source.exists():
        raise FileNotFoundError(f"Icon source not found: {source}")

    icon = source_icon(source)
    save_png(icon)
    save_ico(icon)
    save_nsis_bitmaps(icon)


if __name__ == "__main__":
    main()

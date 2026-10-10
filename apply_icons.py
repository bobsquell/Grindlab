"""Remplace les icônes Android par défaut de Capacitor par celles de GrindLab.

Usage : python apply_icons.py android/app/src/main/res
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
ICON = ROOT / "icon-512.png"
ADAPTIVE = ROOT / "icon-maskable-512.png"
BACKGROUND = "#0f1a1f"

LAUNCHER = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FOREGROUND = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def main(res: Path) -> None:
    if not res.is_dir():
        sys.exit(f"Dossier introuvable : {res}")
    icon = Image.open(ICON).convert("RGB")
    adaptive = Image.open(ADAPTIVE).convert("RGB")
    for density, size in LAUNCHER.items():
        d = res / f"mipmap-{density}"
        d.mkdir(parents=True, exist_ok=True)
        resized = icon.resize((size, size), Image.LANCZOS)
        resized.save(d / "ic_launcher.png")
        resized.save(d / "ic_launcher_round.png")
        fg = FOREGROUND[density]
        adaptive.resize((fg, fg), Image.LANCZOS).save(d / "ic_launcher_foreground.png")
    values = res / "values"
    values.mkdir(parents=True, exist_ok=True)
    (values / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">{BACKGROUND}</color>\n</resources>\n',
        encoding="utf-8")
    print("icônes écrites dans", res)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))

"""Export browser icons from the site's existing Group Ironman helmet artwork."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
helmet = Image.open(ROOT / 'docs/img/osrs-theme/group-ironman-helm.png').convert('RGBA')
square = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
square.alpha_composite(helmet, ((48 - helmet.width) // 2, (48 - helmet.height) // 2))
square.save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
square.resize((96, 96), Image.Resampling.NEAREST).save(ROOT / 'favicon.png')
square.resize((180, 180), Image.Resampling.LANCZOS).save(ROOT / 'apple-touch-icon.png')
print('Group Ironman icons exported: ICO, 96px PNG and 180px touch icon.')

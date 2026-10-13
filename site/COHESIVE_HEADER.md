# Cohesive Old School header

The shared Old School header keeps the approved five-player composition in one
banner. Its current asset is `docs/img/osrs-theme/united-gimps-cutout-banner.webp`
(2172 × 724), with genuine transparency around the United Gimps wordmark,
crossed swords, five players, five pets and ten flanking characters.

The courtyard, upper wall and embedded pillar strips were removed after the
high-resolution page background and separate ivy pillars were published.
The page material now continues through all empty banner areas. The header
uses 110% image width and a centred −5% offset, cropping empty margins while
keeping the solid side-character silhouettes visible. Status cards, navigation
and page content retain their common width inside the page pillars.

The `data-osrs-header="cohesive"` marker selects the combined foreground and
suppresses duplicate logos and companions. Modern restores its existing
banner at 1200 × 265. The approved 1536 × 512 JPEG, original logo, legacy
courtyard image and companion sprites remain available in the project.

See [CUTOUT_HEADER.md](CUTOUT_HEADER.md) for asset paths, provenance,
generation prompts and verification, and [HIGH_RES_FRAME.md](HIGH_RES_FRAME.md)
for the page material and pillars.

To restore the approved courtyard banner, revert the transparent-header
commit. The sharper stone background and separate pillars are an earlier,
independent change.

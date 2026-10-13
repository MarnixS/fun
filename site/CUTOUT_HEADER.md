# Transparent Old School header

The approved cohesive banner supplies the composition: five large players and their five companions below the United Gimps wordmark and crossed swords, with five small side characters on each side. The transparent replacement removes the courtyard, upper wall and embedded columns. The live page supplies the stone material and continuous ivy pillars implemented first in commit `506f2836811566ad050765e4221cc39ecf24bb15`.

## Project assets

- `docs/img/osrs-theme/united-gimps-cutout-banner.webp`: 2172 × 724, RGBA, 445,802 bytes. Generated at the same 3:1 aspect ratio as the original banner.
- `docs/img/osrs-theme/cutout-banner.json`: dimensions, source hashes and provenance.
- `docs/img/osrs-theme/united-gimps-cohesive-banner.jpg`: retained approved reference, 1536 × 512.

The WebP uses quality 95 without resampling. Its alpha is byte-identical to the generated PNG. The alpha has genuinely empty areas and soft edges. Visual QA composited the asset over the actual stone material; the result has no courtyard rectangle or old columns. All five players, five pets, ten side characters and complete wordmark are present. The final pass used explicit original coordinates to preserve relative placement.

The shared header and theme bootstrap select this same transparent asset before scripts and after theme toggles. Modern restores its existing banner and dimensions. The cohesive layout uses 110% width and a centred −5% offset. This crops the empty margins while keeping the solid foreground inside the frame: visible alpha above 128 occupies x=108..2049, inside the retained x=98.7..2073.3 window. The page stone remains visible through the banner. Phone headers use the available screen width; desktop headers align with the existing content allocation. The original 3:1 aspect ratio prevents layout shifts from source dimensions.

## Generation

Mode: built-in Image Generation, image edit with `transparent_background: true`, referencing the approved cohesive banner. Two passes were used; the second is the installed asset.

Initial prompt:

Edit the supplied United Gimps website banner as a precise foreground cutout. This is a background removal task, not a redesign. Keep the original very wide 3:1 canvas and the exact relative positions, sizes, poses, identities, clothing colours and shapes of every foreground element.

Preserve the entire UNITED GIMPS stone-letter logo in the upper middle, including its two crossed swords and golden hilts. Preserve all five large players in the lower middle, in the same left-to-right order. Preserve all five pets in their original positions: the grey cat, golden dog, brown bear, red crab and white EOC ghost, including the EOC lettering. Preserve all ten small side characters across the top, five to the left and five to the right of the logo, including their weapons, hats, capes, utensils and held objects. Every character, pet, letter and sword must remain where it is in the reference. Do not change faces, outfits, numbers of characters or any text. Keep the low-poly Old School RuneScape character aesthetic.

Remove every part of the background: all dark stone behind the logo and side characters, all sky, trees, distant buildings, courtyard walls, courtyard paving, floor, and both embedded ivy stone pillars at the far edges. These removed areas must be true transparent alpha, including gaps between letters, between limbs and weapons, between subjects and around hair and clothing. Do not replace the background with black, grey, a checkerboard, scenery or another colour. Do not retain any rectangular panel, floor slab, wall, skyline or embedded pillar.

Use clean anti-aliased cutout edges without bright matte halos. Preserve only a very subtle soft contact shadow immediately under the players and pets where needed, fading quickly to transparency, so the foreground blends naturally when placed directly over the website's newly implemented dark, weathered stone backdrop. Do not add a glow, border, outline, new props or new background. The result should be the original composition with the backdrop and old pillars removed, ready as one transparent website banner.

Final refinement prompt:

Perform precise background removal on this ORIGINAL United Gimps banner. Preserve its composition exactly: do not rearrange, enlarge, repaint, recast or move any logo, character or pet. Treat this as making a clean alpha matte from the supplied image. Match the entire original 1536-by-512 canvas (3:1); a higher-resolution proportional canvas is fine only if every foreground object occupies the same normalized coordinates.

Keep the whole stone UNITED GIMPS wordmark, the two crossed swords with gold hilts, all five main players, their five pets (grey cat, golden dog, brown bear, red crab, white EOC ghost with the EOC text), and all ten small side characters. Keep their original Old School RuneScape polygonal models, exact clothing, hair, faces, equipment, silhouettes, poses and relative sizes. Leave the bottom of the main players at the same canvas edge as the reference.

IMPORTANT ORIGINAL ALIGNMENT, in coordinates on the 1536x512 reference:
- The stone-letter wordmark occupies x=470..1054, y=100..184. The crossed swords occupy approximately x=600..912, y=55..216. Do not enlarge the wordmark to fill the space.
- The FIVE LEFT side characters have centre x positions approximately 122, 192, 263, 340, 416, with the chef last. Keep these as a tight group exactly where they are, not spread across the left third. They occupy roughly x=95..445 and y=55..213.
- The FIVE RIGHT side characters have centre x positions approximately 1108, 1198, 1277, 1343, 1404. Keep them as a tight group exactly where they are. They occupy roughly x=1070..1435 and y=55..214.
- The five large players have centre x positions approximately 433, 594, 762, 927, 1100, with heads around y=210 and boots ending at y=511. Their pets stay at their ORIGINAL adjacent positions.
- The original pillar strips at x=0..95 and x=1445..1535 become empty transparent margins. Do not pull the side characters outward into these margins.

Erase ALL scenery to true transparency: the upper dark stone wall, courtyard floor/paving, low walls, buildings, trees, sky and both ivy pillars. Also erase scenery inside every gap between letters, swords, limbs, weapons, characters and pets. Do not substitute a background or draw a floor. Retain only subtle contact shadows immediately below feet, fading quickly to transparent, if they are needed. Use clean anti-aliased edges without a coloured or white fringe.

Deliver one transparent foreground asset with the exact original arrangement. No extra characters, new animals, new props, changed lettering, border or glow. The transparent areas will reveal the website's dark stone background and its separate high-resolution ivy pillars.

## Verification

Generated-page and local-resource checks cover all 22 routes in both public and compatibility forms. Existing theme tests check the new asset and its dimensions, Modern restoration, saved choices, asynchronous loading and return to Old School. Header simulation, player-image restoration, navigation and clean-route checks also run. PNG-to-WebP QA checks dimensions and exact alpha preservation. Managed browser QA was unavailable; the art composite is a visual asset check rather than a screenshot of the rendered site.


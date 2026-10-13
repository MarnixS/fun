# High-resolution Old School frame

The previous 910 × 347 `bg2.jpg` combined both columns with the central wall.
Stretching that bitmap to the browser width also enlarged its 47-pixel columns.
The replacement separates the materials while retaining the frame and content
width calculations, the continuous columns and the portrait layout.

## Saved project assets

- `docs/img/osrs-theme/ivy-pillar-hires.webp`: 768 × 2048, transparent pillar.
  Its solid silhouette is 241 pixels wide, over five times the original width.
- `docs/img/osrs-theme/stone-backdrop-hires.webp`: 1254 × 1254, repeating wall.
  It displays at 400 CSS pixels, keeping source detail on screens at 3× density.
- `docs/img/osrs-theme/hires-frame.json`: dimensions, hashes and provenance.

Both WebP files use high-quality encoding without resampling; the pillar alpha is preserved exactly. The background frame
is static shared markup; it clips off-screen columns and appears only in Old
School. Its right column mirrors the left. There is no extra network API or
JavaScript texture renderer. Original theme assets remain available.

## Generation

Mode: built-in Image Generation, editing the original `bg2.jpg` reference.

Pillar prompt:

Use case: precise-object-edit. Asset type: a repeating website pillar texture, a project asset for ugimps.com. The attached image is the existing Old School RuneScape website frame. Reconstruct ONLY the LEFT EDGE PILLAR as a sharply detailed high-resolution asset. Preserve the actual original design: an irregular, narrow shaft of six or seven rounded weathered warm brown-grey stone blocks with softly chipped sculpted edges, thin green ivy vines curling up around the stones and a few small leaves. Preserve the original silhouette, material colours and gentle frontal light. This is the same original classic RuneScape stone-and-ivy pillar, not a new column design. Use an orthographic front view and realistic detailed stone grain. Render one straight vertical repeat unit of the shaft, filling the image height with partial stones cut by the top and bottom boundaries so copies connect continuously. Top and bottom must match seamlessly. No top capital, base, pedestal, plinth, decorative trim or horizontal border. The vertical shaft must remain slender, with the natural proportions shown in the reference; approximately width:height 1:7.4. Output a narrow portrait transparent PNG at the highest native resolution, ideally 512 x 4096 pixels, with the pillar and ivy filling the width and height and very little empty padding. All other background removed to genuine transparency. No central wall texture, text, logo, people or extra objects. Crisp fine new material detail, no low-resolution interpolation, JPEG blocks, blur or exaggerated sharpening.

Stone prompt:

Use case: precise-object-edit. Asset type: seamless high-resolution repeating dark stone website backdrop for ugimps.com. The attached image is the existing RuneScape website frame. Reconstruct ONLY its central dark irregular stone texture as a square seamless tile. Keep the same original Old School RuneScape material aesthetic and muted warm brown-charcoal palette: large irregular tightly fitting rough stone slabs with near-black narrow recessed joints, subtle subdued olive moss, natural crisp pitting, faint mottled mineral grain and softly worn edges. Flat orthographic face-on texture, no perspective. Approximately five or six large stones across the tile, not a dense field of tiny pebbles. Very dark, low contrast and understated, matching the reference rather than a bright new environment. Uniform diffuse front lighting; no large light spot, directional gradient or vignette baked in. All four edges must tile seamlessly. No pillars, borders, ivy vines, lettering, logos, characters, objects or scenery. Keep it faithful to the original texture while rebuilding lost fine detail at the highest native resolution, ideally 2048 x 2048 pixels or larger. Sharp clean genuine material detail, no pixel blocks, blur or oversharpened outlines.

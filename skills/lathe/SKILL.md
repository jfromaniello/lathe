---
name: lathe
description: Design 3D-printable vases, bowls, lamp shades, bins, pots and other round or square hollow objects with Lathe (lathe3d.com) by writing its URLs, check them with its JSON endpoint and look at them as an image or a live 3D preview. Use when someone asks for a printable vessel or container, or to change, explain or show a Lathe design or link.
---

# Lathe

Lathe (https://lathe3d.com) makes printable objects of revolution: a profile turned round an axis, with ribs, lobes, twist,
a slanted mouth, holes and lettering on top. A design lives entirely in the URL's query string, so designing one means
writing a URL. Nothing to install, no account.

## The four URLs

All take the same query string (below).

| URL | What |
|---|---|
| `https://lathe3d.com/?…` (English) · `https://lathe3d.com/es?…` (Spanish) | The editor: the person tweaks it and exports the STL / 3MF. |
| `https://lathe3d.com/view?…` · `/es/view?…` | Look-only page: the piece alone, to turn round with a finger, and one button to the editor. Best link to send to a phone. |
| `https://lathe3d.com/api/og?…` | PNG, 1200 × 630: a three-quarter render of the piece plus its size and a few facts. Use it to *see* your design. |
| `https://lathe3d.com/api/design?…` | JSON: size, wall, what the limits changed, which holes and texts can't be made and why, the three links above, and every parameter as used. Add `l=es` for Spanish links. |

**Workflow:** write the query → GET `/api/design?…` → fix anything with `ok: false` (`adjusted`, `cuts[i].problem`,
`texts[i].problem`) → fetch `/api/og?…` and look at it (save the PNG and open it, if your tools can't show images inline) →
iterate → give the person the `preview` link (to look) and the `editor` link (to export). If you can drive a browser,
the `/view` page shows it live in 3D.

## Parameters

Lengths in mm, angles in degrees. Leave out anything at its default; out-of-range values are clamped, unknown keys
ignored. Arrays are comma-separated (`%2C` in a URL), lists of holes and texts are joined by `~` (`%7E`).

### Size and silhouette

| Key | Param | Default | Range | Notes |
|---|---|---|---|---|
| `h` | height | 180 | 5–1000 | Total height. |
| `r` | radius | 40 | 2–500 | Radius (half-width of a square section) before the profile. |
| `p` | profile | `1,1,1,1,1,1,1` | 2–16 values, 0.05–3 | Radius multipliers evenly spaced from the bottom to the top, smooth (Catmull-Rom) between them. `0.7,0.95,1,1,0.95,0.85,0.75` = belly; `1.2,1,0.85,0.8,0.85,1,1.2` = waist. |
| `sq` | squareness | 0 | 0–1 | 0 circle → 1 square (rounded superellipse). |
| `m` | mode | `shell` | `shell`, `solid` | `solid` = a closed solid meant for the slicer's vase mode (spiralize); holes need `shell`. |

### Ribs (fine pattern round the outside)

| Key | Param | Default | Range | Notes |
|---|---|---|---|---|
| `rc` | ribCount | 72 | 0–1000 | 0 = smooth. |
| `ra` | ribAmplitude | 1.2 | −50–50 | Depth in mm; negative swaps ridges and grooves. 0.3–0.6 = a texture, 1–2 = flutes, 4+ = big pleats (fewer ribs). |
| `rw` | ribWaveform | `scallop` | `sine`, `triangle`, `scallop`, `square` | Scallop = round flutes with sharp valleys. |
| `rs` | ribSharpness | 0.5 | 0–1 | Only for `square`. |
| `r0` / `r1` | ribStart / ribEnd | 0.3 / 1 | 0–1 | Fraction of the height the ribs cover; plain wall outside it. |
| `rf` | ribFade | 0 | 0–500 | mm over which the ribs fade in and out at those ends (0 = a step). |
| `al` | ribAlign | `center` | `center`, `crest`, `valley` | What sits on the profile: `crest` carves grooves inwards (the plain zones are flush with the crests), `valley` grows ribs outwards. |

### Lobes (big waves round the section)

| Key | Param | Default | Range | Notes |
|---|---|---|---|---|
| `lc` | lobeCount | 0 | 0–64 | 0 = none. 3–5 = a flower/twisted vase, 8–12 = a pumpkin. |
| `la` | lobeAmplitude | 8 | −100–100 | mm either side of the profile. |
| `lw` | lobeWaveform | `sine` | as `rw` | `scallop` gives rounded segments with creases between them. |
| `lp` | lobeProfile | `0,0.8,1,1,1,0.8,0` | 2–16 values, 0–3 | Lobe strength up the height, like `p`. |

### Twist

| Key | Param | Default | Range | Notes |
|---|---|---|---|---|
| `tw` | twist | 0 | −3600–3600 | Degrees the section turns from bottom to top; ribs and lobes become spirals. |
| `tc` | twistCurve | `0,0.167,0.333,0.5,0.667,0.833,1` | 2–16 values | Fraction of the twist reached up the height (default = steady). `0,0.5,0.85,1,0.85,0.5,0` turns and comes back. |

### Wall, floor and top

| Key | Param | Default | Range | Notes |
|---|---|---|---|---|
| `w` | wall | 1.2 | 0.2–50 | Wall at the deepest valley. 1.2 decorative, 2–3 sturdy, 3+ for things that get knocked. |
| `ir` | innerRib | 0 | 0–1 | 0 = smooth inside (wall thicker at the crests), 1 = the inside follows the ribs (constant wall). |
| `b` | bottom | 1.6 | 0–100 | Floor thickness; 0 = open (a lamp shade, a sleeve). |
| `t` | top | 0 | 0–100 | Top plate thickness; 0 = open mouth. |
| `th` | topHole | 20 | 0–500 | Half-width of the hole in a closed top (lamp socket E27 ≈ 20.5). |
| `ths` | topHoleShape | `follow` | `circle`, `follow` | `follow` = the section's shape. |
| `td` | topDome | 0 | −500–500 | mm the top plate bulges (+) or dishes (−). |

### Slanted mouth

| Key | Param | Default | Range | Notes |
|---|---|---|---|---|
| `sc` | slant | 0 | 0–500 | mm the rim drops from its high side to its low side (a tilted cut instead of a flat one). |
| `sca` | slantAngle | 0 | −360–360 | Direction the **low** side faces, same compass as `u` below: 0 right, 90 back, 180 left, 270 front. |

### Two pieces (a lid or a top that slides on)

| Key | Param | Default | Range | Notes |
|---|---|---|---|---|
| `sp` | split | 0 | 0–1 | Fraction of the height where the shell is cut in two (0 = one piece). Exports a 3MF with both. |
| `sl` | splitLip | 6 | 1–100 | Height of the neck on the body that the top slides over. |
| `sg` | splitGap | 0.2 | 0–5 | Clearance between neck and top. |

### Holes: `cut=shape,mode,u,z,w,h,depth~…`

- `shape`: `c` circle, `s` square (axis-aligned rectangle).
- `mode`: `p` pocket (sunk `depth` mm into the wall, ≤ wall − 0.3), `t` through this wall, `b` both sides (through this wall and the opposite one at the same height: a bar or a dowel across).
- `u`: where round the piece, 0–1 (see *Where things go*). `z`: height of the centre, 0–1 of `h`.
- `w`: width (diameter for a circle) in mm. `h`: height in mm (repeat `w` for a circle). `depth`: mm, used by pockets.
- A through hole may run past an open rim: it cuts a notch. Holes need `m=shell`, must not overlap, and keep 1 mm from floor, rim and joint.

### Lettering: `tx=font,relief,u,z,size,depth,text~…`

- `font`: `sans` (heavy grotesque), `serif` (display serif), `condensed` (tall caps), `script` (brush script).
- `relief`: `r` raised out of the surface (its face stays flat above the ribs), `e` engraved (≤ wall − 0.3 in a shell).
- `u`, `z` as for holes (centre of the text). `size`: font size in mm (capitals come out ~70 % of it). `depth`: mm, 0.6–1.2 reads well.
- `text`: any Latin text, accents and ñ included; escape `%` as `%25`, `,` as `%2C`, `~` as `%7E` (then URL-encode as usual: space `%20`, `'` is fine).
- Text is straight (horizontal); keep it on a calm part of the wall and check its `width` in `/api/design`.

### Look (not part of the shape)

| Key | Default | Values |
|---|---|---|
| `c` | `f1ece3` | Colour, hex without `#` (e.g. `d9661f` orange, `2a2a2a` black, `c47a5e` terracotta). |
| `mat` | `matte` | `matte`, `wood`, `glass` (translucent, lit from inside like a lamp). |

`seg` and `hseg` are preview resolution only: leave them out.

## Where things go

`u` goes round the section counter-clockwise seen from above: **`u=0` right, `0.25` back, `0.5` left, `0.75` front** (the
side the editor's “Front” view faces; the `/api/og` render and the default 3D view look from the front-right, at about
`u=0.85`, so put the face of a design between `0.75` and `0.9`). Two marks at
`u=0.72` and `0.78` sit side by side on the front. With a twist the section turns, and `u` turns with it: to face the
front at height fraction `z`, use `u = 0.75 − twist·curve(z)/360` (for the steady curve, `curve(z) = z`).

`z` is a fraction of the height measured on the real surface; under a slanted mouth the rim on the low side is lower, so
keep marks below `1 − slant/h` there.

Sizes: a hole of `w` mm needs `w + 1 < 0.45 ×` the perimeter at its height; a text must be shorter than the perimeter.

## Designing well

- Start from what the object is for, then the silhouette (`h`, `r`, `p`), then one surface idea (ribs *or* lobes, maybe twist). Restraint reads better than everything at once.
- Printable without supports: keep the profile's overhangs gentle (a multiplier changing by less than ~0.25 between neighbouring points for a typical size), holes in a vertical wall up to ~30 mm, lettering 0.6–1.2 mm deep.
- Things that take a beating (a knock box, a planter): `w` 2.5–3, `b` 3–4. A vase: `w` 1.2–1.6. Vase mode: `m=solid` and keep ribs shallow.
- Pockets 0.3–0.5 mm short of the wall make a thin skin that glows with a light inside (`mat=glass` previews it).
- Evoke rather than spell out: a pumpkin is `lc=9&la=10&lw=scallop` with a squat profile and orange `c`, not a carved face.

## Examples

- Swirl vase: `?h=200&r=52&p=0.8%2C0.95%2C1.02%2C1%2C0.92%2C0.84%2C0.88&rc=180&ra=0.7&r0=0&lc=3&la=12&lp=0.15%2C0.9%2C1%2C1%2C0.75%2C0.25%2C0&tw=150&sc=45`
- Twist lamp shade (E27, open bottom): `?h=120&r=65&p=0.55%2C0.82%2C0.97%2C1%2C0.97%2C0.85%2C0.65&rc=8&ra=6&rw=sine&r0=0&tw=70&ir=1&b=0&t=2&th=20.5&mat=glass`
- Coffee knock box (broomstick bar across, name on the right side): `?h=115&r=55&p=0.91%2C1%2C1%2C1%2C1%2C1%2C1&rc=80&ra=1&r0=0.11&r1=0.94&rf=2&al=crest&tw=-2&w=3&b=4&sc=34&cut=c%2Cb%2C0.749%2C0.668%2C26%2C26%2C0.6&tx=script%2Cr%2C0%2C0.438%2C14%2C0.9%2CFranca%27s&c=c47a5e`
- Halloween candy bowl (pumpkin, glowing eyes, “boo” at the back): `?h=110&r=74&p=0.66%2C0.92%2C1%2C1%2C0.94%2C0.8%2C0.62&rc=150&ra=0.35&rw=sine&r0=0&lc=9&la=10&lw=scallop&lp=0.3%2C0.85%2C1%2C1%2C1%2C0.8%2C0.45&tw=14&w=2.4&b=3&sc=18&sca=200&cut=c%2Cp%2C0.715%2C0.6%2C14%2C14%2C2%7Ec%2Cp%2C0.785%2C0.6%2C14%2C14%2C2&tx=script%2Ce%2C0.25%2C0.3%2C16%2C1%2Cboo&c=d9661f`

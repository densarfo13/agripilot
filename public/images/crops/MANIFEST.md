# /public/images/crops — production crop photo slots

Drop curated, real-photo WebP files here, exactly named by the
canonical crop key. The 16 crops below are the priority pilot
set — each row maps to a single file the new image pipeline
expects (see `src/config/cropImages.js → CROP_IMAGE_PATHS_V2`).

| Crop          | Filename            | Aspect | Notes                                |
|---------------|---------------------|--------|--------------------------------------|
| tomato        | `tomato.webp`       | 1:1    | Ripe red on vine, daylight           |
| maize         | `maize.webp`        | 1:1    | Cob in husk or growing stalk         |
| pepper        | `pepper.webp`       | 1:1    | Bell or chili, glossy skin           |
| cassava       | `cassava.webp`      | 1:1    | Root + leaf or tuber close-up        |
| onion         | `onion.webp`        | 1:1    | Bulb with papery skin                |
| leafy-greens  | `leafy-greens.webp` | 1:1    | Mixed greens or kale                 |
| okra          | `okra.webp`         | 1:1    | Pods on plant or harvested           |
| rice          | `rice.webp`         | 1:1    | Paddy field or grain head            |
| yam           | `yam.webp`          | 1:1    | Tuber on soil                        |
| plantain      | `plantain.webp`     | 1:1    | Hand of plantain on tree             |
| beans         | `beans.webp`        | 1:1    | Pods or dry beans                    |
| potato        | `potato.webp`       | 1:1    | Tuber with brushed soil              |
| carrot        | `carrot.webp`       | 1:1    | Whole carrot with greens             |
| basil         | `basil.webp`        | 1:1    | Fresh leaves close-up                |
| spinach       | `spinach.webp`      | 1:1    | Loose-leaf bunch                     |
| herbs         | `herbs.webp`        | 1:1    | Mixed culinary herbs                 |

## Pipeline rules

- **Format**: WebP, square 1:1, ≤ 80 KB, ≥ 512 px on the short side.
- **Lighting**: natural daylight, no over-saturation.
- **Background**: shallow depth-of-field or clean soil/foliage.
- **Filename**: lowercase, hyphenated; no spaces, no underscores.
- **Fallback**: if a real photo is not yet available, `getCropImagePath`
  falls back through `/images/crops/<key>.webp` →
  `/crops/<key>.webp` (legacy illustrations) →
  `/images/placeholders/crop.svg` (generic crop placeholder SVG).

## Adding a new slot

1. Drop the WebP file into this folder.
2. Confirm the canonical key is listed in
   `CROP_IMAGE_PATHS_V2` in `src/config/cropImages.js`.
3. No other code change needed — `<CropImage />` will pick it up.

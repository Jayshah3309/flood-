# River valley landing image

The landing intro uses a reference-guided aerial river photograph generated for
this project. The existing text, navigation, buttons, callouts, and timing remain
separate React/CSS layers.

- `river-valley-hero.webp`: 1672 x 941 desktop hero.
- `river-valley-hero-mobile.webp`: 960 px wide lighter download for small screens.

`components/intro/Flood3DScene.tsx` selects the mobile file with `<picture>`.
`components/intro/intro.css` uses `object-fit: cover` and a very small camera
drift. `components/intro/photographic-scene.ts` adds a transparent WebGL layer:
its shader samples the same image and distorts only a feathered river corridor,
while a separate 3D pass draws the sensor device. The forest and mountains are
never repainted by the water shader. Reduced motion freezes both passes.

The image was generated with the attached reference as the primary composition:
a winding river from the lower left toward the center distance, a forested left
mountain, distant right-side ridges, dense tropical canopy, and early-morning
natural light. No text or UI is baked into the image.

The device is the existing `MonitoringBuoy` geometry from `scene.ts`, including
its enclosure, GPS puck, mast, solar panel, and transducers. There is currently
no supplied GLB or photograph of the physical device. `scene-cinematic.ts` is
retained as non-rendered implementation history.

The device materials use restrained PBR plastic, metal, and rubber properties
with a small procedural normal map. The photo overlay clips its lower hull at
the waterline and composites local shadow, wake, and water across that edge.
These details improve the prototype's visual integration but cannot establish
an exact likeness to physical hardware without a device reference photograph.

## Image generation prompt

Use case: photorealistic-natural
Asset type: full-bleed responsive website hero landscape, widescreen 16:9
Input image: the user's attached low-resolution river-valley photo is the PRIMARY composition reference. Preserve its geographic arrangement: an aerial view down a winding river entering from the lower left, bending through dense tropical forest toward the center distance; steep forested mountain mass on the left, lower distant ridges across the horizon and on the right; continuous forest canopy and natural riverbanks.
Primary request: Recreate this landscape as an ultra-realistic, high-resolution professional drone photograph. The final image should look like a real optical photograph, not a render or illustration.
Scene: naturally irregular tropical mountain geology, dense and uneven forest with thousands of distinct tree canopies, varied height and subdued green tones, natural shoreline erosion and vegetation. River water is dark green-blue with depth/color variation, restrained surface ripples and soft reflections of trees, slopes, and pale sky.
Lighting: authentic early-morning daylight, soft sun diffused by light cloud, slight distant atmospheric haze only, believable shadows, neutral white balance, restrained contrast and exposure.
Framing: broad cinematic aerial perspective, strong river focal path from foreground to distant valley, natural depth, usable detail across the frame for desktop and mobile cropping. No buildings, roads, boats, devices, labels, people, UI, text, or watermark.
Avoid: CGI, game-engine appearance, low-poly geometry, repeated foliage, smooth artificial mountains, plastic water, mirror reflections, oversaturated greens, excessive fog, exaggerated bloom, fantasy color grading, impossible perspective, over-sharpening.


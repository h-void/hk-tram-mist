# TRAMLINE MIST // 香江雨霧・叮叮

**A Zero-Asset Procedural 3D Hong Kong Rainy-Corner Diorama, Planar Reflection Shader & Spatial Soundscape**

[![Live 3D Diorama](https://img.shields.io/badge/▶_Launch_Live_3D_Diorama-141619?style=for-the-badge)](https://h-void.github.io/hk-tram-mist/?lang=en)
[![Archival Print Mode](https://img.shields.io/badge/Xuan_Paper_Print_Mode-B83A2A?style=for-the-badge)](https://h-void.github.io/hk-tram-mist/?lang=en&mode=print)
[![License: MIT](https://img.shields.io/badge/License-MIT-4B525C?style=for-the-badge)](./LICENSE)

Built with **Three.js · TypeScript · Custom GLSL Shaders · Procedural Canvas PBR · Web Audio API** (`0` external 3D models, `0` runtime image assets, `0` audio samples)

> *A compressed spatial memory of rainy Hong Kong: Hong Kong Island's green double-decker tramways, a Wan Chai cha chaan teng and bamboo-scaffolded tenement, and Kowloon's elevated Kwun Tong Line viaduct converge into a floating orthographic diorama suspended in radial monsoon mist.*

<p align="center">
  <a href="https://h-void.github.io/hk-tram-mist/?lang=en">
    <img src="./public/og.jpg" alt="TRAMLINE MIST — Zero-Asset Procedural 3D Hong Kong Rainy-Corner Diorama" width="100%" />
  </a>
</p>

---

## Core Graphics & Audio Architecture

1. **Zero-Asset Procedural 3D Architecture, Living Street & Canvas PBR (`src/scene/buildings.ts`, `viaductAndVehicles.ts`, `propsAndLife.ts`, `textures.ts`)**
   - Every architectural volume, double-decker tram (`#120` with sweeping rain wiper, wet-catenary micro-spark, rear ruby tail-glow, wheel mist spray, teak benches, brass rails & passengers), **16-seat Green-Roof Hong Kong Minibus (`#28 銅鑼灣` with rotating wheels, twin wipers, backlit route placards, sculpted twin-fan AC pod, sliding window mullions, interior `58 km/h` LED speedometer & cabin silhouettes)**, elevated Kwun Tong Line viaduct with under-soffit linear light fixtures and 2-car Metro-Cammell train (elongated dual-rail headlight glint & pantograph micro-sparks), idling red Hong Kong taxi, 1958 curved Streamline Moderne *cha chaan teng* rooftop terrace, Chinese gable noodle shop with rising broth steam & swaying red *dai pai dong* lamp, bamboo scaffold with **pulsing amber safety beacon (`地盤閃燈`) & bilingual caution banner**, stepped Kowloon companion tenement (`B6`), jade mosaic tenement (`B4`) with warm-lit rooftop shack & laundry line, Wan Chai MTR Exit A3 canopy with dual-map backlit vending machines, **East Under-Viaduct Route 101 Bus Stop Shelter**, airy layered Bauhinia & weeping banyan trees, illuminated vintage telephone booth, pillar postbox, **newspaper kiosk with animated ginger-white roof cat**, spinning rooftop whirlybird turbines & HVAC chiller fans, `望左/望右` tarmac stencils, and yellow tactile guide paths is constructed purely from TypeScript geometry and deterministic Canvas2D albedo/roughness/emissive/bump textures (**`3,999` meshes · `119,480` triangles · `~232 KB` gzipped**).
   - **3D Glass Neon Tubes & Volumetric Monsoon Mist Halos**: Every projecting Hong Kong neon sign pairs 3D glowing glass perimeter trim tubes with preset-balanced humid-air additive mist halos.
   - **Synchronized 14-Second Hong Kong Traffic Signal & Articulated Life**: Full four-phase HK traffic lights (Vehicle Red → Red+Amber pre-green + 2.8 Hz Flashing Green Man → Vehicle Green → Amber) mathematically phase-locked to 28-second Tram #120 and Minibus #28 loops, **live-colored wet-asphalt traffic-signal puddle reflections**, and 3 articulated strolling pedestrians (including a zebra-crossing walker who waits politely at the curb on red), plus gliding rain-mist pigeons and gravity-accelerated eave rain drips with ground impact splash ripples.

2. **Orthographic-Compatible Rain-Rippled Planar Wet Reflection & Radial Mist Shaders (`src/scene/roadAndReflections.ts`, `atmosphere.ts`)**
   - **`PlanarWetReflector`**: Renders a live mirrored scene pass to a **`768×768 HalfFloat`** render target with zero per-frame object allocations, then applies **procedural GLSL multi-cell expanding raindrop ripple normal perturbation**, a **9-tap anisotropic vertical-streaking wet-asphalt blur**, **HDR soft-knee highlight compression**, chromatic neon saturation preservation, and wet dark-tar Fresnel grading.
   - **Injected World-Space Radial Mist (`applyRadialMistFade`)**: Patches Three.js PBR, `LineBasicMaterial`, and instanced materials via `onBeforeCompile` so roads, rails, viaducts, and north-west skyline silhouettes dissolve seamlessly into monsoon mist with zero hard diorama edges.
   - **Orthographic/Perspective Volumetric Light Cones (`createSoftLightConeMaterial`)**: Custom GLSL Fresnel + axial fade cones eliminating hard-edged cone silhouettes alongside 12 preset-balanced street/shop/under-viaduct point lights (plus 3 vehicle-mounted point lights).

3. **`[P]` Archival Axonometric Engraving & `[A]` GLSL Spatial Acoustic Field (`src/scene/weatherAndEffects.ts`)**
   - **`[P]` Print Mode & Built-In Hidden-Line Vector SVG Export**: Dynamically swaps surfaces onto Xuan-paper matte shaders (`#F4EFE6`) with delicate blush/celadon botanical washes for trees, extracts crisp `26°` `EdgesGeometry` architectural line art in Prussian blue, pine soot, and cinnabar red (highlighting Tram #120 and the red taxi), feathers outer ink lines smoothly into Xuan-paper margins via radial mist fade, filters foliage and decorative micro-meshes (`skipPrintEdges`), keeps moving vehicles and walking pedestrians synced live, and includes a built-in **3× orthographic 24-bit depth-buffered hidden-line-removed Vector SVG exporter** (`__SCENE_CTRL__.getPrintEdgeSVG`).
   - **`[A]` GLSL Acoustic Field Mode & Tapered Drizzle**: Uses a custom multi-harmonic radial wavefront GLSL shader to visualize live sound wavefronts radiating from neon transformers, tram rails, elevated viaduct trains, Minibus #28, **phase-locked HK pedestrian crossing beeper pulses**, rainfall, and interactive vehicle bell/horn pulses, paired with tapered GLSL falling drizzle streaks, eave drips with impact ripples, and rising noodle-shop steam.

4. **Procedural Hong Kong Web Audio Soundscape (`src/audio/hkSoundscape.ts`)**
   - Synthesizes filtered stereo pink-noise monsoon rain with breeze LFO modulation, randomized tin-roof raindrop bandpass bursts, subtle Hong Kong 50/100 Hz neon ballast hum, proximity-modulated steel rail rumble, **phase-locked Hong Kong audible pedestrian crossing piezo cadence** (`1.25 Hz` steady green → `6.25 Hz` flashing green → silent on red), a 5-partial metallic double-ding tram bell (`1,285 Hz` / `1,302 Hz`), and polite dual-tone Hong Kong vehicle horns for the Green-Roof Minibus (`392/494 Hz`) and Red Taxi (`440/554 Hz`).

---

## Controls & URL Parameters

- **Orbit / Zoom / Pan**: Drag to rotate, scroll/pinch to zoom (with aspect-aware portrait frustum scaling for mobile), click the **double-decker tram** (or press `Space`) for the double-ding bell, or click the **Green-Roof Minibus / Red Taxi** for dual-tone horns and vehicle-colored wavefront pulses.
- **`1` / `2` / `3`**: Dusk Mist · Midnight Neon · Dawn Mist lighting & bloom presets.
- **`Q` / `W` / `E`**: Isometric Overview · Tram Follow Close-Up · Street Corner cameras.
- **`[A]`**: Toggle Spatial Acoustic Wavefront Field.
- **`[P]`**: Toggle Archival Axonometric Print Mode.
- **`[M]`**: Toggle procedural rain & street soundscape.
- **URL Parameters**: `?lang=en` (default) | `?lang=zh`, `?preset=dusk|midnight|dawn`, `?view=iso|tram|street`, `?mode=diorama|acoustic|print`, `?hud=0|1`, `?t=<seconds>`.

---

## Local Development

```bash
npm ci
npm run dev      # Local Vite dev server
npm run build    # Strict TypeScript check + relative-base Vite production bundle -> dist/
npm run preview  # Preview dist/ locally
```

## License

MIT

# TRAMLINE MIST // 香江雨霧・叮叮

**A Zero-Asset Procedural 3D Hong Kong Rainy-Corner Diorama, Planar Reflection Shader & Spatial Soundscape**

Built with **Three.js · TypeScript · Custom GLSL Shaders · Procedural Canvas PBR · Web Audio API** (`0` external 3D models, `0` image files, `0` audio samples)

> *A compressed spatial memory of rainy Hong Kong: Hong Kong Island's green double-decker tramways, a Wan Chai cha chaan teng and bamboo-scaffolded tenement, and an elevated Kowloon Metro-Cammell viaduct converge into a floating orthographic diorama suspended in radial monsoon mist.*

---

## Core Graphics & Audio Architecture

1. **Zero-Asset Procedural 3D Architecture & Canvas PBR (`src/scene/buildings.ts`, `viaductAndVehicles.ts`, `propsAndLife.ts`, `textures.ts`)**
   - Every architectural volume, double-decker tram (`#120` with transparent rain-glinted glazing, teak benches, brass rails, passengers & side mirrors), elevated Metro-Cammell viaduct, red Hong Kong taxi, 1958 curved Streamline Moderne *cha chaan teng* rooftop terrace, Chinese gable noodle shop, bamboo scaffold, stepped Kowloon companion tenement (`B6`), Wan Chai MTR Exit A3 canopy with dual-map backlit vending machines, weeping banyan pocket park, illuminated vintage telephone booth, pillar postbox, `望左/望右` tarmac stencils, and yellow tactile guide paths is constructed purely from TypeScript geometry and deterministic Canvas2D albedo/roughness/emissive/bump textures (**`3,609` meshes · `107,118` triangles · `~216 KB` gzipped**).

2. **Orthographic-Compatible Planar Wet-Road Reflection & Radial Mist Shaders (`src/scene/roadAndReflections.ts`, `atmosphere.ts`)**
   - **`PlanarWetReflector`**: Renders a live mirrored scene pass to a `512×512 HalfFloat` render target with zero per-frame object allocations, then applies a **9-tap anisotropic vertical-streaking wet-asphalt blur**, world-space micro-grain shimmer, **HDR soft-knee highlight compression**, and wet dark-tar Fresnel grading.
   - **Injected World-Space Radial Mist (`applyRadialMistFade`)**: Patches Three.js PBR, `LineBasicMaterial`, and instanced materials via `onBeforeCompile` so roads, rails, viaducts, and distant depth-tested skyline silhouettes dissolve smoothly into mist with zero hard rectangular diorama edges.
   - **Orthographic/Perspective Volumetric Light Cones (`createSoftLightConeMaterial`)**: Custom GLSL Fresnel + axial fade cones eliminating hard-edged cone silhouettes alongside 11 preset-balanced street/shop point lights.

3. **`[P]` Archival Axonometric Engraving & `[A]` Acoustic Field (`src/scene/weatherAndEffects.ts`)**
   - **`[P]` Print Mode**: Dynamically swaps surfaces onto Xuan-paper matte shaders (`#F4EFE6`), extracts crisp `26°` `EdgesGeometry` architectural line art in Prussian blue, pine soot, and cinnabar red (highlighting the tram and taxi), feathers outer ink lines smoothly into Xuan-paper margins via radial mist fade, filters foliage and decorative micro-meshes (`skipPrintEdges`), and properly disposes GPU buffers on toggle.
   - **`[A]` Acoustic Field Mode & Tapered GLSL Drizzle**: Visualizes live sound wavefronts radiating from neon transformers, tram rails, elevated viaduct trains, rainfall, and interactive double-ding bell pulses, paired with tapered GLSL falling drizzle streaks and soft concentric puddle ripples.

4. **Procedural Hong Kong Web Audio Soundscape (`src/audio/hkSoundscape.ts`)**
   - Synthesizes filtered stereo pink-noise monsoon rain with breeze LFO modulation, randomized tin-roof raindrop bandpass bursts, subtle Hong Kong 50/100 Hz neon ballast hum, proximity-modulated steel rail rumble, and a 5-partial metallic double-ding tram bell (`1,285 Hz` / `1,302 Hz`).

---

## Controls & URL Parameters

- **Orbit / Zoom / Pan**: Drag to rotate, scroll/pinch to zoom (with aspect-aware portrait frustum scaling for mobile), click the double-decker tram (or press `Space`) to ring the double-ding bell.
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

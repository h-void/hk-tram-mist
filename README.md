# TRAMLINE MIST // 香江雨霧・叮叮

**A Zero-Asset Procedural 3D Hong Kong Rainy-Corner Diorama, Planar Reflection Shader & Spatial Soundscape**

Built with **Three.js · TypeScript · Custom GLSL Shaders · Procedural Canvas PBR · Web Audio API** (`0` external 3D models, `0` image files, `0` audio samples)

> *A compressed spatial memory of rainy Hong Kong: Hong Kong Island's green double-decker tramways, a Wan Chai cha chaan teng and bamboo-scaffolded tenement, and an elevated Kowloon Metro-Cammell viaduct converge into a floating orthographic diorama suspended in radial monsoon mist.*

---

## Core Graphics & Audio Architecture

1. **Zero-Asset Procedural 3D Architecture & Canvas PBR (`src/scene/buildings.ts`, `viaductAndVehicles.ts`, `propsAndLife.ts`, `textures.ts`)**
   - Every architectural volume, double-decker tram, elevated rail viaduct, red Hong Kong taxi, bamboo scaffold, neon sign, tile dado, double-yellow curb stripe, and green pedestrian signal is constructed purely from TypeScript geometry and deterministic Canvas2D albedo/roughness/emissive/bump textures (~210 KB gzipped total bundle).

2. **Orthographic-Compatible Planar Wet-Road Reflection & Radial Mist Shaders (`src/scene/roadAndReflections.ts`, `atmosphere.ts`)**
   - **`PlanarWetReflector`**: Renders a live mirrored scene pass to a `512×512 HalfFloat` render target with zero per-frame object allocations, then applies a 5-tap wet-asphalt anisotropic blur, animated rain-ripple UV shimmer, and wet dark-tar Fresnel grading.
   - **Injected World-Space Radial Mist (`applyRadialMistFade`)**: Patches Three.js PBR and instanced materials via `onBeforeCompile` so roads, rails, and viaducts dissolve smoothly into mist with zero hard rectangular diorama edges.
   - **Orthographic/Perspective Volumetric Light Cones (`createSoftLightConeMaterial`)**: Custom GLSL Fresnel + axial fade cones eliminating hard-edged cone silhouettes.

3. **`[P]` Archival Axonometric Engraving & `[A]` Acoustic Field (`src/scene/weatherAndEffects.ts`)**
   - **`[P]` Print Mode**: Dynamically swaps surfaces onto Xuan-paper matte shaders and extracts crisp `EdgesGeometry` architectural line art in Prussian blue, pine soot, and cinnabar red (highlighting the tram and taxi), filtering noisy decorative micro-meshes and properly disposing GPU buffers on toggle.
   - **`[A]` Acoustic Field Mode**: Visualizes live sound wavefronts radiating from neon transformers, tram rails, elevated viaduct trains, rainfall, and interactive double-ding bell pulses.

4. **Procedural Hong Kong Web Audio Soundscape (`src/audio/hkSoundscape.ts`)**
   - Synthesizes filtered stereo pink-noise monsoon rain with breeze LFO modulation, randomized tin-roof raindrop bandpass bursts, subtle Hong Kong 50/100 Hz neon ballast hum, proximity-modulated steel rail rumble, and a 5-partial metallic double-ding tram bell (`1,285 Hz` / `1,302 Hz`).

---

## Controls & URL Parameters

- **Orbit / Zoom / Pan**: Drag to rotate, scroll/pinch to zoom, click the double-decker tram (or press `Space`) to ring the double-ding bell.
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

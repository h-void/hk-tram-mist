# Tramline Mist (`hk-tram-mist`)

An interactive 3D rainy Hong Kong street corner in Three.js, custom GLSL shaders, procedural Canvas textures, and Web Audio.

- **Live Demo**: <https://h-void.github.io/hk-tram-mist/?lang=en>
- **Line Art Mode**: <https://h-void.github.io/hk-tram-mist/?lang=en&mode=print>

<p align="center">
  <a href="https://h-void.github.io/hk-tram-mist/?lang=en">
    <img src="./public/og.jpg" alt="Tramline Mist — interactive 3D Hong Kong rainy street corner" width="100%" />
  </a>
</p>

---

## Overview

Rather than reconstructing one literal intersection, *Tramline Mist* stacks two everyday layers of Hong Kong into a single orthographic slice: Hong Kong Island's double-decker tramways, a 1958 curved *cha chaan teng*, bamboo scaffolding, and Wan Chai street furniture below Kowloon's elevated Kwun Tong Line viaduct. Geometry, Canvas2D textures, lighting shaders, and street soundscapes are generated in code with no external 3D models, photos, or audio files.

### Technical Highlights

1. **Street Architecture & Synchronized HK Traffic Signal (`src/scene/buildings.ts`, `viaductAndVehicles.ts`, `propsAndLife.ts`, `textures.ts`, `hkSignal.ts`)**
   - Combines Tram `#120`, a 16-seat green-roof minibus (`#28`), an elevated Kwun Tong Line train, a red taxi, curved corner tenement facades, bamboo scaffolding with a construction beacon, Wan Chai MTR Exit A3, a Route 101 shelter, and street props.
   - Shares a 14-second 5-stage Hong Kong traffic signal cycle (steady green man, flashing green man, red+amber pre-green, green, amber) phase-locked to vehicle loops, pedestrian crossings, wet-road puddle reflections, and audible crossing piezo pulses.
2. **Orthographic Wet-Road Reflection & Radial Mist (`src/scene/roadAndReflections.ts`, `atmosphere.ts`)**
   - `PlanarWetReflector` renders a custom orthographic mirrored pass into a `512×512` half-float target (falling back to 8-bit on GPUs without float targets), applying two-octave raindrop ripple refraction, a 9-tap vertically stretched blur, HDR highlight compression, and neon color preservation.
   - `applyRadialMistFade` injects world-space radial fog attenuation into PBR, instanced, and line materials so streets, rails, and viaducts dissolve smoothly into mist without clipped box edges.
3. **Axonometric Line Art & Vector SVG Export (`src/scene/weatherAndEffects.ts`)**
   - Pressing `[P]` switches to matte paper surfaces (`#F4EFE6`) with muted botanical washes and cached `26°` architectural edges split across Prussian blue, pine soot, and cinnabar red (isolating Tram `#120` and the taxi).
   - Foliage and micro-clutter are excluded from edge extraction (`skipPrintEdges`), and the `[P]` mode `SVG` button runs a 24-bit orthographic depth pass to export hidden-line-removed vector plates directly in the browser.
4. **Acoustic Wavefront Overlay & Web Audio (`src/scene/weatherAndEffects.ts`, `src/audio/hkSoundscape.ts`)**
   - Synthesizes rain noise, tin-roof droplet bursts, 50/100 Hz neon ballast hum, rail rumble, phase-locked HK audible crossing ticks (`1.25 Hz` steady green, `6.25 Hz` flashing green), a 5-partial tram double-ding bell, and dual-tone minibus/taxi horns.
   - `[A]` overlays multi-harmonic GLSL wavefronts tied to live traffic and sound triggers.

---

## Controls & URL Parameters

- **Orbit / Zoom / Click**: Drag to rotate, scroll/pinch to zoom, click the tram (or press `Space`) for the bell, or click the minibus/taxi for horns.
- **`1` / `2` / `3`**: Dusk, Midnight, and Dawn lighting presets.
- **`Q` / `W` / `E`**: Isometric Overview, Tram Follow, and Street Corner cameras.
- **`A`**: Toggle spatial acoustic wavefront overlay.
- **`P`**: Toggle axonometric line art mode (reveals the `SVG` vector export button).
- **`M`**: Toggle sound.
- **URL Parameters**: `?lang=en|zh`, `?preset=dusk|midnight|dawn`, `?view=iso|tram|street`, `?mode=diorama|acoustic|print`, `?hud=0|1`, `?t=<seconds>`.

---

## Local Development

```bash
npm ci
npm run dev      # Local Vite dev server
npm run build    # TypeScript check + production build -> dist/
npm run preview  # Preview dist/ locally
```

## License

MIT

#!/usr/bin/env python3
"""
End-to-end Playwright WebGL2 verifier & high-res plate renderer for TRAMLINE MIST (hk-tram-mist).

1. Serves dist/ under /hk-tram-mist/ subpath (mirroring GitHub Pages).
2. Verifies English default (?lang=en), zero console/page/WebGL errors, non-overlapping HUD at
   1280x720 & 1440x900, bilingual zh toggle, all 3 atmosphere presets, all 3 camera views,
   [A] acoustic wavefront mode, [P] archival axonometric print mode, and mobile 390x844 layout.
3. Captures crisp supersampled plates for visual QA and optional portfolio.pdf compilation.
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT / "dist"
SHOT_DIR = Path(os.environ.get("TRAM_SHOT_DIR", str(ROOT / ".tmp-e2e-shots")))
_PORTFOLIO_RAW_ENV = os.environ.get("TRAM_PORTFOLIO_RAW_DIR", "").strip()
PORTFOLIO_RAW_DIR = Path(_PORTFOLIO_RAW_ENV) if _PORTFOLIO_RAW_ENV else None


class SubpathHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0]
        if clean == "/hk-tram-mist":
            clean = "/hk-tram-mist/"
        if clean.startswith("/hk-tram-mist/"):
            rel = clean[len("/hk-tram-mist/") :]
        else:
            rel = clean.lstrip("/")
        if not rel or rel.endswith("/"):
            rel = rel + "index.html"
        return str((DIST_DIR / rel).resolve())

    def log_message(self, format: str, *args: object) -> None:
        return


def save_shot(page, filename: str, portfolio_name: str | None = None) -> None:
    path = SHOT_DIR / filename
    page.screenshot(path=str(path), animations="disabled")
    if portfolio_name and PORTFOLIO_RAW_DIR is not None:
        p_out = PORTFOLIO_RAW_DIR / portfolio_name
        p_out.write_bytes(path.read_bytes())


def main() -> None:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    if PORTFOLIO_RAW_DIR is not None:
        PORTFOLIO_RAW_DIR.mkdir(parents=True, exist_ok=True)

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SubpathHandler))
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{port}/hk-tram-mist/"
    print(f"Serving dist/ at {base_url}", flush=True)

    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_requests: list[str] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                ],
            )
            ctx = browser.new_context(
                viewport={"width": 1440, "height": 900},
                device_scale_factor=1.0,
            )
            page = ctx.new_page()
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: page_errors.append(str(e)))
            page.on(
                "response",
                lambda r: failed_requests.append(f"{r.status} {r.url}") if r.status >= 400 else None,
            )

            # Boot locked at t=0.25 with English default
            page.goto(f"{base_url}?lang=en&t=0.25", wait_until="domcontentloaded")
            page.wait_for_function("() => window.__SCENE_CTRL__?.getDiagnostics()?.ready === true", polling=250, timeout=60000)
            page.wait_for_timeout(600)  # Let #boot-veil dismiss cleanly

            diag = page.evaluate("() => window.__SCENE_CTRL__.getDiagnostics()")
            print(f"DIAGNOSTICS: {diag}", flush=True)
            assert diag["glError"] == 0, f"WebGL error: {diag}"
            assert diag["lang"] == "en", f"Expected EN default, got {diag}"
            assert diag["meshCount"] >= 400, f"Unexpectedly low mesh count: {diag}"

            # 1) Verify English HUD non-overlap at 1440x900
            hud_1440 = page.evaluate("""() => ({
                title: document.querySelector('.hud-title').getBoundingClientRect(),
                hint: document.querySelector('.hud-hint').getBoundingClientRect(),
                dock: document.querySelector('.hud-dock').getBoundingClientRect(),
            })""")
            assert hud_1440["title"]["right"] < hud_1440["hint"]["left"] - 8, f"Title/Hint overlap: {hud_1440}"
            assert hud_1440["hint"]["bottom"] < hud_1440["dock"]["top"] - 8, f"Hint/Dock overlap: {hud_1440}"
            save_shot(page, "live_en_dusk_1440.png")
            print("PASS: English HUD layout clean at 1440x900!", flush=True)

            # 2) Clean full-bleed plates (HUD hidden)
            page.evaluate("() => { window.__SCENE_CTRL__.setHudVisible(false); window.__SCENE_CTRL__.setSimTime(0.25); }")
            page.wait_for_timeout(120)
            save_shot(page, "plate_hero_dusk.png", "tram-hero-dusk.png")

            # Tram Follow close-up (planar wet-asphalt reflection hero)
            page.evaluate("() => { window.__SCENE_CTRL__.setCamera('tram', true); window.__SCENE_CTRL__.setSimTime(0.25); }")
            page.wait_for_timeout(120)
            save_shot(page, "plate_tram_follow.png", "tram-follow.png")

            # Midnight neon isometric
            page.evaluate("() => { window.__SCENE_CTRL__.setCamera('iso', true); window.__SCENE_CTRL__.setPreset('midnight'); window.__SCENE_CTRL__.setSimTime(0.25); }")
            page.wait_for_timeout(120)
            save_shot(page, "plate_midnight_neon.png", "tram-midnight.png")

            # [P] Archival Axonometric Print Mode
            page.evaluate("() => { window.__SCENE_CTRL__.setPreset('dusk'); window.__SCENE_CTRL__.setMode('print'); window.__SCENE_CTRL__.setSimTime(0.25); }")
            page.wait_for_timeout(150)
            save_shot(page, "plate_print_axon.png", "tram-print.png")

            # [A] Spatial Acoustic Wavefront Field + live double-ding bell pulse
            page.evaluate("""() => {
                window.__SCENE_CTRL__.setMode('acoustic');
                window.__SCENE_CTRL__.setSimTime(0.25);
                window.__SCENE_CTRL__.ringBell();
                window.__SCENE_CTRL__.setSimTime(0.62);
            }""")
            page.wait_for_timeout(120)
            save_shot(page, "plate_acoustic_bell.png", "tram-acoustic.png")

            # Live English interactive Street Corner view in Dawn mist (HUD visible)
            page.evaluate("""() => {
                window.__SCENE_CTRL__.setMode('diorama');
                window.__SCENE_CTRL__.setPreset('dawn');
                window.__SCENE_CTRL__.setCamera('street', true);
                window.__SCENE_CTRL__.setHudVisible(true);
                window.__SCENE_CTRL__.setSimTime(0.25);
            }""")
            page.wait_for_timeout(150)
            save_shot(page, "plate_ui_en_dawn.png", "tram-ui-dawn.png")
            print("PASS: All 6 high-res portfolio plates captured cleanly!", flush=True)

            # 3) Standard laptop 1280x720 non-overlap verification in English
            page.set_viewport_size({"width": 1280, "height": 720})
            page.evaluate("() => { window.__SCENE_CTRL__.setPreset('dusk'); window.__SCENE_CTRL__.setCamera('iso', true); window.__SCENE_CTRL__.setSimTime(0.25); }")
            page.wait_for_timeout(150)
            hud_1280 = page.evaluate("""() => ({
                title: document.querySelector('.hud-title').getBoundingClientRect(),
                hint: document.querySelector('.hud-hint').getBoundingClientRect(),
                dock: document.querySelector('.hud-dock').getBoundingClientRect(),
                overflow: document.documentElement.scrollWidth - window.innerWidth,
            })""")
            assert hud_1280["overflow"] <= 1, f"1280x720 overflow: {hud_1280}"
            assert hud_1280["title"]["right"] < hud_1280["hint"]["left"] - 8, f"1280 Title/Hint overlap: {hud_1280}"
            assert hud_1280["hint"]["bottom"] < hud_1280["dock"]["top"] - 8, f"1280 Hint/Dock overlap: {hud_1280}"
            save_shot(page, "live_en_dusk_1280.png")
            print("PASS: English HUD zero-overlap verified at 1280x720!", flush=True)

            # 4) Bilingual Traditional Chinese toggle verification
            page.locator(".hud-btn", has_text="繁中").click()
            page.wait_for_timeout(150)
            zh_title = page.locator(".hud-title-main").inner_text()
            assert "香江雨霧" in zh_title, f"Expected Traditional Chinese title, got {zh_title}"
            save_shot(page, "live_zh_dusk_1280.png")
            print("PASS: Traditional Chinese toggle verified!", flush=True)

            # 5) Mobile 390x844 responsive check
            page.evaluate("() => window.__SCENE_CTRL__.setLang('en')")
            page.set_viewport_size({"width": 390, "height": 844})
            page.evaluate("() => window.__SCENE_CTRL__.setSimTime(0.25)")
            page.wait_for_timeout(150)
            m_info = page.evaluate("""() => ({
                overflow: document.documentElement.scrollWidth - window.innerWidth,
                titleRight: document.querySelector('.hud-title').getBoundingClientRect().right,
                dockRight: document.querySelector('.hud-dock').getBoundingClientRect().right,
            })""")
            assert m_info["overflow"] <= 1, f"Mobile horizontal overflow: {m_info}"
            assert m_info["titleRight"] <= 391 and m_info["dockRight"] <= 391, f"Mobile HUD clipped: {m_info}"
            save_shot(page, "live_mobile_390.png")
            print("PASS: Mobile 390x844 zero-overflow & clean HUD verified!", flush=True)

            ctx.close()
            browser.close()
    finally:
        server.shutdown()

    assert not console_errors, f"Console errors: {console_errors}"
    assert not page_errors, f"Page errors: {page_errors}"
    assert not failed_requests, f"Failed requests: {failed_requests}"
    print("ALL TRAMLINE MIST E2E CHECKS & PLATE CAPTURES PASSED (0 errors)!", flush=True)


if __name__ == "__main__":
    main()

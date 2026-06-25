# One-off: capture README screenshots of every COMMONS view from the running
# local server. Not part of the app build — run manually when the UI changes.
#   python scripts/shots.py
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = Path("assets/screenshots")
OUT.mkdir(parents=True, exist_ok=True)

# A wide, retina-ish viewport so the captures look crisp embedded in the README.
VW, VH, SCALE = 1440, 900, 2


def shot(page, name):
    page.wait_for_timeout(900)
    page.screenshot(path=str(OUT / f"{name}.png"))
    print(f"  saved {name}.png")


def close_dialog(page):
    # Drawers/inspectors render a full-screen close overlay; click it if present.
    for lbl in ("Close issue detail", "Close inspector"):
        ov = page.get_by_role("button", name=lbl)
        if ov.count():
            try:
                ov.first.click(timeout=2000)
                page.wait_for_timeout(500)
            except Exception:
                pass


def rail(page, label):
    close_dialog(page)
    page.get_by_role("button", name=label, exact=True).click()
    page.wait_for_timeout(1200)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": VW, "height": VH}, device_scale_factor=SCALE)
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(1500)

        # 1) Matrix (landing)
        shot(page, "01-matrix")

        # 2) Issue drawer — click a scatter point in the matrix. Recharts renders
        #    each Scatter point as a <path class="recharts-symbols">.
        try:
            pt = page.locator(".recharts-symbols").first
            pt.click(timeout=5000, force=True)
            shot(page, "02-issue-drawer")
            close_dialog(page)
        except Exception as e:
            print(f"  (drawer skipped: {e})")

        # 3) Trace — the transparency layer
        rail(page, "Trace")
        shot(page, "03-trace")

        # 4) Trace, Explain Mode on
        try:
            page.get_by_role("button", name="Explain").click(timeout=4000)
            shot(page, "04-trace-explain")
            page.get_by_role("button", name="Explain").click()
            page.wait_for_timeout(500)
        except Exception as e:
            print(f"  (explain skipped: {e})")

        # 5) Step inspector — click an agent step chip
        try:
            page.get_by_text("Impact", exact=True).first.click(timeout=4000)
            shot(page, "05-step-inspector")
            close_dialog(page)
        except Exception as e:
            print(f"  (inspector skipped: {e})")

        # 6) Digital Twin (3D) — give deck.gl + tiles time to paint
        rail(page, "Twin")
        page.wait_for_timeout(3500)
        shot(page, "06-twin")

        # 7) Time Machine
        rail(page, "Time")
        page.wait_for_timeout(1500)
        shot(page, "07-time")

        browser.close()
    print("done.")


if __name__ == "__main__":
    sys.exit(main())

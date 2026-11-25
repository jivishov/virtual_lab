"""Exercise the rendered WebGL lab using real mouse events and the student notebook."""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import Thread

from playwright.async_api import async_playwright

REPO = Path(__file__).resolve().parents[3]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


async def progress(page, index):
    await page.wait_for_function(
        "n => Number(document.querySelector('#progressTrack').getAttribute('aria-valuenow')) === n",
        arg=index, timeout=30000,
    )


async def marked_item(page):
    marker = page.locator("#marker")
    await marker.wait_for(state="visible")
    await page.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    bounds = await marker.bounding_box()
    point = (bounds["x"] + bounds["width"]/2, bounds["y"] + bounds["height"]/2)
    if not await page.evaluate("p => document.elementFromPoint(...p)?.id === 'bench'", list(point)):
        await page.locator("#focusBtn").click()
        await page.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
        bounds = await marker.bounding_box()
        point = (bounds["x"] + bounds["width"]/2, bounds["y"] + bounds["height"]/2)
    return point


async def run(base_url):
    async with async_playwright() as driver:
        browser = await driver.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH"),
            args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
        )
        page = await browser.new_page(viewport={"width": 1366, "height": 768}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto(base_url, wait_until="domcontentloaded")
        await page.locator("body[data-ready=true]").wait_for(timeout=85000)
        await page.locator("#settingsBtn").click()
        await page.select_option("#quality", "low")
        await page.locator("#settingsPanel [data-close]").click()

        transfers = {2,4,8,9,10,14,15,16,19,20,24,25,27,32,33,34,39,40,41,46,47,48,53,54,55}
        drags = {2,8,15,25,34,48,55}
        for index in range(58):
            if index == 11:
                await progress(page, 12)  # Dissolution may finish while the pipette is being discarded.
                continue
            await progress(page, index)
            source = await marked_item(page)
            await page.mouse.click(*source)
            if index in transfers:
                await page.wait_for_function("document.querySelector('#tip').textContent.startsWith('Now select')")
                target = await marked_item(page)
                if index in drags:
                    await page.mouse.move(*source)
                    await page.mouse.down()
                    await page.mouse.move(*target, steps=6)
                    await page.mouse.up()
                else:
                    await page.mouse.click(*target)

        await progress(page, 58)
        await page.locator("#notebookBtn").click()
        await page.locator("#completeCleanup").click()
        await progress(page, 58)
        for item in await page.locator("#checks input").all():
            await item.check()
        await page.locator("#completeCleanup").click()
        await progress(page, 59)
        mass = float((await page.locator("#bookMass").inner_text()).split()[0])
        absorbance = float(await page.locator("#readings tr:last-child td:last-child").inner_text())
        percent = (absorbance + 0.00538)/2.426 * 0.100 * 63.55 / mass * 100
        await page.locator("#answer").fill("25")
        await page.locator("#checkAnswer").click()
        await progress(page, 59)
        await page.locator("#answer").fill(f"{percent:.2f}")
        await page.locator("#checkAnswer").click()
        await progress(page, 60)
        async with page.expect_download() as pending:
            await page.locator("#download").click()
        download = await pending.value
        csv = (await download.path()).read_text()
        assert "Completed steps,60" in csv and "unknown,," in csv and "blank,0,0.000" in csv
        assert not errors, errors
        print(f"60 steps completed. Brass {mass:.3f} g, unknown {absorbance:.3f} A, copper {percent:.2f}%.")
        await browser.close()


if __name__ == "__main__":
    handler = partial(QuietHandler, directory=str(REPO))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            asyncio.run(run(f"http://127.0.0.1:{server.server_port}/experiments/copperinbrass_v2/"))
        finally:
            server.shutdown()

// Leave the startup HUD through the same controls as a learner choosing the standard bench.
async function useStandardBench(page) {
  if (await page.evaluate(() => lab.hand.state.active)) await page.locator('#cameraButton').click();
  if (await page.evaluate(() => lab.studio.immersive)) await page.locator('#exitImmersive').click();
}

module.exports = {useStandardBench};

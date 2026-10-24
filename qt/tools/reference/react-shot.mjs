// Screenshots of the React Dial at 480 x 480, driven with its development keys (SocketProviderValue's
// keyboard map: ArrowLeft / ArrowRight turn, Space pushes, Enter is the context button), for comparing the Qt
// screens with the original:
//   node react-shot.mjs <url> <out-dir> "<steps>"
// steps: comma-separated; "shot:<name>" saves <out-dir>/<name>.png, "wait:<ms>", a key name ("ArrowLeft",
// "Enter", "Space", ...), "keys:<key>x<n>", "eval:<js>".
import { chromium } from 'playwright';
import fs from 'node:fs';

const [url, outDir, steps = 'wait:6000,shot:home'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
// Only this machine resolves: the React build reaches no real service (tickets, Sentry, Community).
const browser = await chromium.launch({
  args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1']
});
const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(url);
for (const step of steps.split(',').map((s) => s.trim()).filter(Boolean)) {
  const [kind, ...rest] = step.split(':');
  const arg = rest.join(':');
  if (kind === 'shot') {
    await page.screenshot({ path: `${outDir}/${arg}.png` });
    console.log('saved', `${outDir}/${arg}.png`);
  } else if (kind === 'wait') {
    await page.waitForTimeout(Number(arg));
  } else if (kind === 'keys') {
    const [key, n] = arg.split('x');
    for (let i = 0; i < Number(n); i++) {
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
    }
  } else if (kind === 'eval') {
    console.log(await page.evaluate(arg));
  } else {
    await page.keyboard.press(step);
    await page.waitForTimeout(150);
  }
}
await browser.close();

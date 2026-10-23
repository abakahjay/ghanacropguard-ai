// Scroll-through screenshots (triggers entrance animations) at 1440 and 390.
import { chromium } from "@playwright/test";
const [,, url, out, ...rest] = process.argv;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [w, h, tag] of [[1440, 900, "d"], [390, 844, "m"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  if (rest[0] === "--login") {
    await pg.goto(new URL("/login", url).href);
    await pg.getByLabel("Email").fill(rest[1]); await pg.getByLabel("Password").fill(rest[2]);
    await pg.getByRole("button", { name: "Sign in" }).click(); await pg.waitForURL(/\/(app|admin)/);
  }
  await pg.goto(url, { waitUntil: "networkidle" });
  const H = await pg.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += h / 2) { await pg.evaluate((yy) => window.scrollTo(0, yy), y); await pg.waitForTimeout(120); }
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${out}-${tag}.png`, fullPage: true });
  await ctx.close();
}
await b.close();

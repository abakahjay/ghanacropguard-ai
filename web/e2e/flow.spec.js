import { expect, test } from "@playwright/test";
import { deflateSync } from "node:zlib";

/** Build a real PNG in memory (solid colour), so the test needs no fixture files. */
function png(w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).map((_, i) => rgb[i % 3])]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const shots = process.env.E2E_SCREENSHOTS;
async function shot(page, name, project) {
  if (shots) await page.screenshot({ path: `${shots}/${project}-${name}.png`, fullPage: true });
}

test("landing, crop guide and limits pages render", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Photograph the leaf");
  await expect(page.getByRole("link", { name: "Check a leaf" }).first()).toBeVisible();
  await shot(page, "landing", info.project.name);
  await page.goto("/crops");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Four crops, twenty-two conditions");
  await page.getByRole("link", { name: /Cassava/ }).click();
  await expect(page.getByRole("heading", { name: "Mosaic" })).toBeVisible();
  await shot(page, "crop-cassava", info.project.name);
  await page.goto("/limitations");
  await expect(page.getByRole("heading", { name: "Measured accuracy" })).toBeVisible();
  await shot(page, "limitations", info.project.name);
});

test("sign-in options, forgot and reset password pages, author credit", async ({ page }, info) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
    "href",
    /\/api\/v1\/auth\/google\?app=cropguard&redirect_uri=/,
  );
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill(`nobody-${info.project.name}@example.com`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists for that email")).toBeVisible();
  await shot(page, "forgot", info.project.name);

  // A reset link without its #token is refused before anything is sent.
  await page.goto("/reset-password");
  await expect(page.getByRole("alert")).toContainText("incomplete");

  // Google sign-up needs the two consent boxes first.
  await page.goto("/register");
  const google = page.getByRole("button", { name: "Sign up with Google" });
  await expect(google).toBeDisabled();
  await page.getByLabel("I am 16 years old or older.").check();
  await page.getByLabel(/I accept the Terms of Use/).check();
  await expect(page.getByRole("link", { name: "Sign up with Google" })).toHaveAttribute("href", /consent=1/);

  await page.goto("/");
  await expect(page.getByTestId("link-footer-portfolio")).toHaveAttribute("href", "https://portfolio-8jmo.onrender.com/");
  await expect(page.getByTestId("link-footer-portfolio")).toHaveText("Abakah Joshua");
});

test("register, upload, result, history, delete", async ({ page }, info) => {
  const email = `e2e-${info.project.name}-${Date.now()}@example.com`;
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Cassava2026");
  await page.getByLabel("Confirm password").fill("Cassava2026");
  await page.getByLabel("Region").selectOption("Ashanti");
  await page.getByLabel("I am 16 years old or older.").check();
  await page.getByLabel(/I accept the Terms of Use/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await shot(page, "workspace", info.project.name);

  // gallery selection -> compression preview -> upload -> result page
  await page.locator("input[type=file]:not([capture])").setInputFiles({
    name: "leaf.png",
    mimeType: "image/png",
    buffer: png(1600, 1200, [20, 210, 40]),
  });
  await expect(page.getByText("Sending")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retake" })).toBeVisible();
  await page.getByRole("button", { name: "Check this leaf" }).click();
  await expect(page).toHaveURL(/\/app\/results\//, { timeout: 30_000 });
  await expect(page.getByRole("list", { name: "Model confidence by condition" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "What you can do next" })).toBeVisible();
  await expect(page.getByText("not a diagnosis")).toBeVisible();
  await expect(page.getByRole("img", { name: /Your photo/ })).toBeVisible();
  await shot(page, "result", info.project.name);

  // save + note
  await page.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();
  await page.getByLabel("Your note").fill("Plot by the river");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved.")).toBeVisible();

  // history search
  await page.goto("/app/history");
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await page.getByPlaceholder("Search a condition, crop or note").fill("river");
  await expect(page.getByText("Plot by the river")).toBeVisible();
  await page.getByPlaceholder("Search a condition, crop or note").fill("zzz-no-match");
  await expect(page.getByText("No checks match these filters.")).toBeVisible();
  await page.getByPlaceholder("Search a condition, crop or note").fill("");
  await shot(page, "history", info.project.name);

  // invalid file is rejected client-side with a clear message
  await page.goto("/app");
  await page.locator("input[type=file]:not([capture])").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByRole("alert").filter({ hasText: "not a photo" })).toBeVisible();

  // delete from history
  await page.goto("/app/history");
  await page.getByRole("button", { name: /Delete .* result/ }).click();
  await expect(page.getByText("You have not checked any leaves yet.")).toBeVisible();
});

test("admin dashboard is protected and shows live statistics", async ({ page }, info) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("AdminPass123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "Requests per day" })).toBeVisible();
  await expect(page.getByText("Successful predictions", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Model in service" })).toBeVisible();
  await shot(page, "admin", info.project.name);
});

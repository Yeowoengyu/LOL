import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

// The managed browser disallows file:// navigation. Serve just the exported
// document, without an asset server, to verify the self-contained artifact.
const html = await readFile(resolve("artifacts/draft-lab.html"));
const server = createServer((request, response) => {
  if (request.url !== "/draft-lab.html") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const documentUrl = `http://127.0.0.1:${server.address().port}/draft-lab.html`;
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const networkRequests = [];
  const errors = [];
  await context.route(/^https?:/, async (route) => {
    if (route.request().url() === documentUrl) {
      await route.continue();
      return;
    }
    networkRequests.push(route.request().url());
    await route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(documentUrl);
  await page
    .getByRole("heading", { name: "밴픽 시뮬레이터", exact: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator(".champion-card img")
    .first()
    .evaluate((img) => img.decode());
  await page.screenshot({ path: "artifacts/homepage.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({
    path: "artifacts/homepage-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  async function choose(name) {
    await page.getByRole("textbox", { name: "챔피언 검색" }).fill(name);
    await page
      .getByRole("button", { name: `${name} 선택`, exact: true })
      .click();
    await page.getByRole("button", { name: /^(밴|픽) 확정$/ }).click();
  }
  for (const name of [
    "티모",
    "샤코",
    "신지드",
    "마스터 이",
    "유미",
    "문도 박사",
    "야스오",
  ])
    await choose(name);
  await page.getByRole("button", { name: "벡스 추천 선택" }).click();
  await page.getByRole("button", { name: "픽 확정" }).click();
  await page.getByRole("button", { name: "레드팀 벡스 상대법 보기" }).click();
  assert(
    await page
      .getByRole("dialog")
      .getByText("스킬 상호작용 가이드", { exact: true })
      .isVisible(),
  );
  await page.keyboard.press("Escape");
  await page.reload();
  assert(
    await page
      .getByRole("button", { name: "레드팀 벡스 상대법 보기" })
      .isVisible(),
  );
  for (const name of [
    "징크스",
    "다이애나",
    "쓰레쉬",
    "바이",
    "가렌",
    "나서스",
    "피오라",
    "트린다미어",
    "레오나",
    "케이틀린",
    "오른",
    "럼블",
  ])
    await choose(name);
  await page
    .getByRole("heading", { name: "두 팀의 드래프트가 완성됐어요." })
    .waitFor();
  for (const name of ["블루팀", "레드팀"]) {
    const panel = page.getByRole("complementary", { name });
    assert.equal(await panel.locator(".picked-champion").count(), 5);
    assert.equal(await panel.locator(".ban-slot.filled").count(), 5);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(networkRequests, []);
  console.log(
    "Standalone HTML passed: only the HTML document was served, zero external/asset requests, 20 turns, counter recommendation, matchup, reload persistence, desktop and mobile.",
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}

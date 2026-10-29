import { test, expect } from "@playwright/test";
const bans = ["티모", "샤코", "신지드", "마스터 이", "유미", "문도 박사"];
async function select(page: import("@playwright/test").Page, name: string) {
  const search = page.getByRole("textbox", { name: "챔피언 검색" });
  await search.fill(name);
  await page.getByRole("button", { name: `${name} 선택`, exact: true }).click();
  await page.getByRole("button", { name: /^(밴|픽) 확정$/ }).click();
}

test("plays all 20 turns, shows matchup guide, persists and resets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "밴픽 시뮬레이터", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "밴 확정" })).toBeDisabled();
  for (const name of bans) await select(page, name);
  await select(page, "야스오");
  await expect(
    page.getByRole("button", { name: "벡스 추천 선택" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "벡스 추천 선택" }).click();
  await page.getByRole("button", { name: "픽 확정" }).click();
  await page.getByRole("button", { name: "레드팀 벡스 상대법 보기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("스킬 상호작용 가이드", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      "벡스의 우울과 공포가 잦은 돌진을 사용하는 야스오를 견제해요.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "레드팀 벡스 상대법 보기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(
    page.getByRole("button", { name: "레드팀 벡스 상대법 보기" }),
  ).toHaveCount(0);
  await select(page, "벡스");
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
    await select(page, name);
  await expect(
    page.getByRole("heading", { name: "두 팀의 드래프트가 완성됐어요." }),
  ).toBeVisible();
  for (const team of ["블루팀", "레드팀"]) {
    const panel = page.getByRole("complementary", { name: team });
    await expect(panel.locator(".picked-champion")).toHaveCount(5);
    await expect(panel.locator(".ban-slot.filled")).toHaveCount(5);
  }
  expect(errors).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "두 팀의 드래프트가 완성됐어요." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page.getByRole("button", { name: "초기화하기" }).click();
  await expect(page.getByRole("button", { name: "밴 확정" })).toBeDisabled();
  await expect(page.locator(".phase-count b")).toHaveText("00");
});

test("search, role filters, images, responsive layout and keyboard dialogs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "챔피언 검색" }).fill("ㅇㄹ");
  await expect(
    page.getByRole("button", { name: "아리 선택", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "검색 지우기" }).click();
  await page.getByRole("button", { name: "원딜", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "징크스 선택", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "아리 선택", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "전체 포지션" }).click();
  await page.getByRole("textbox", { name: "챔피언 검색" }).fill("없는챔피언");
  await expect(page.getByText("검색 결과가 없어요")).toBeVisible();
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator(".champion-card img")
    .first()
    .waitFor({ state: "visible" });
  expect(
    await page
      .locator(".champion-card img")
      .first()
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "사용 가이드", exact: false })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "닫기" })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("button", { name: "밴 확정" })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await select(page, "아리");
  await expect(page.locator(".phase-count b")).toHaveText("01");
});

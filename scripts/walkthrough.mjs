import automator from "miniprogram-automator";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = "D:\\ProgramFiles\\WeChatDeveloperTools\\cli.bat";
const projectPath = join(root, "apps", "miniprogram");
const shotDir = join(root, "artifacts", "walkthrough");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  execFileSync(
    "cmd.exe",
    ["/c", cliPath, "auto", "--project", projectPath, "--auto-port", "9420"],
    { stdio: "ignore", timeout: 30_000 },
  );
} catch {
  // 已开启时忽略
}
await sleep(2500);
mkdirSync(shotDir, { recursive: true });

const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
const page = async (name) => {
  const p = await miniProgram.currentPage();
  console.log(`[${name}] path=${p?.path}`);
  return p;
};

// 1. 登录页
await miniProgram.reLaunch("/pages/login/index");
await sleep(1500);
let p = await page("login");
await miniProgram.screenshot({ path: join(shotDir, "01-login.png") });
await p.callMethod("onWechatLogin");
await sleep(4000);
// 首次登录强制隐私协议：滑动到底并同意
let agreePage = await miniProgram.currentPage();
if (agreePage && agreePage.path === "pages/privacy-agreement/index") {
  await agreePage.callMethod("onScrollToBottom");
  await sleep(300);
  await agreePage.callMethod("onAgree");
  await sleep(2500);
}
p = await page("login→calendar");

// 2. 日历
await sleep(2500);
p = await page("calendar");
const months = await p.data("months");
const monthValue = await p.data("monthValue");
const anchor = months.find((m) => m.key === monthValue) ?? months[3] ?? {};
console.log(
  "calendar data:",
  JSON.stringify({
    monthLabel: await p.data("monthLabel"),
    cells: anchor.cells?.length,
    legend: anchor.legend?.length,
    legendColor: anchor.legend?.[0]?.color,
    shiftColor: Object.values(anchor.shiftMap ?? {})?.[0]?.[0]?.color,
    todaySummary: (await p.data("selectedSummary"))?.shiftSnapshot?.name ?? null,
    todayWeather: (await p.data("todayWeather"))?.conditionText ?? null,
    error: await p.data("error"),
    loading: (await p.data("months")).some((m) => m.loading),
  }),
);
await miniProgram.screenshot({ path: join(shotDir, "02-calendar.png") });
// 第一次点击：仅选中，不跳转
await p.callMethod("onDateTap", { detail: { date: "2026-08-06" } });
await sleep(800);
p = await miniProgram.currentPage();
console.log("first tap:", JSON.stringify({ path: p?.path, selectedDate: await p.data("selectedDate") }));
// 第二次点击：进入详情
await p.callMethod("onDateTap", { detail: { date: "2026-08-06" } });
await sleep(1500);
p = await miniProgram.currentPage();
console.log("second tap:", p?.path);
await miniProgram.navigateBack();
await sleep(1200);
p = await miniProgram.currentPage();
// 月份选择器
await p.callMethod("onMonthPickerChange", { detail: { value: "2026-10" } });
await sleep(2000);
p = await miniProgram.currentPage();
console.log(
  "picker month:",
  JSON.stringify({ monthLabel: await p.data("monthLabel"), year: await p.data("year"), month: await p.data("month") }),
);
await p.callMethod("goToday");
await sleep(1500);
p = await miniProgram.currentPage();
await p.callMethod("nextMonth");
await sleep(2500);
console.log("after nextMonth:", await p.data("monthLabel"));
await p.callMethod("goToday");
await sleep(1500);
await p.callMethod("onDateTap", { detail: { date: "2026-08-10" } });
await sleep(800);
await p.callMethod("onDateTap", { detail: { date: "2026-08-10" } });
await sleep(1500);
console.log("detail after tap:", (await miniProgram.currentPage())?.path);
await miniProgram.navigateBack();
await sleep(1500);
p = await miniProgram.currentPage();
console.log(
  "back state:",
  JSON.stringify({
    monthLabel: await p.data("monthLabel"),
    selectedDate: await p.data("selectedDate"),
    selectedSummary: (await p.data("selectedSummary"))?.shiftSnapshot?.name ?? null,
    selectedTitle: await p.data("selectedTitle"),
    scheduleList: anchor.schedules?.length,
    todayWeather: (await p.data("todayWeather"))?.conditionText ?? null,
  }),
);
// 非今日（8-10）卡片 → 临时改班（不应报错，应按日期进入）
await p.callMethod("changeToday");
let cp;
for (let i = 0; i < 16; i += 1) {
  cp = await miniProgram.currentPage();
  const orig = await cp.data("original");
  const err = await cp.data("error");
  if (cp?.path === "pages/schedule-change/index" && (orig || err)) break;
  await sleep(500);
}
console.log(
  "change from 08-10 card:",
  JSON.stringify({
    path: cp?.path,
    date: await cp.data("date"),
    mode: await cp.data("mode"),
    original: (await cp.data("original"))?.shiftSnapshot?.name ?? null,
    templates: (await cp.data("templates"))?.length,
    error: await cp.data("error"),
  }),
);
await miniProgram.navigateBack();
await sleep(1200);
p = await miniProgram.currentPage();

// 3. 周视图
await miniProgram.switchTab("/pages/week/index");
await sleep(2500);
p = await page("week");
console.log("week data:", JSON.stringify({ rows: (await p.data("rows"))?.length, error: await p.data("error") }));
await miniProgram.screenshot({ path: join(shotDir, "03-week.png") });

// 4. 排班详情（今天）
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
await miniProgram.navigateTo(`/pages/schedule-detail/index?date=${today}`);
await sleep(2500);
p = await page("detail");
console.log(
  "detail data:",
  JSON.stringify({
    detail: (await p.data("detail"))?.shiftSnapshot?.name ?? null,
    changeRecords: (await p.data("changeRecords"))?.length,
    isVirtual: await p.data("isVirtual"),
    overtime: await p.data("overtime"),
    error: await p.data("error"),
  }),
);
await miniProgram.screenshot({ path: join(shotDir, "04-detail.png") });

// 5. 临时改班（新建）
await miniProgram.navigateTo(`/pages/schedule-change/index?date=${today}`);
await sleep(2000);
p = await page("change");
console.log("change data:", JSON.stringify({ templates: (await p.data("templates"))?.length, error: await p.data("error") }));
await miniProgram.screenshot({ path: join(shotDir, "05-change.png") });

// 6. 分享（今日 + 本周）
await miniProgram.navigateTo(`/pages/share/index?date=${today}`);
await sleep(2500);
p = await page("share-today");
console.log(
  "share today:",
  JSON.stringify({
    dayCount: await p.data("dayCount"),
    useGrid: await p.data("useGrid"),
    previewEntries: (await p.data("previewEntries"))?.length,
    error: await p.data("error"),
  }),
);
await miniProgram.screenshot({ path: join(shotDir, "06-share-today.png") });
await p.callMethod("onRangeChange", { currentTarget: { dataset: { index: "1" } } });
await sleep(2500);
console.log(
  "share week:",
  JSON.stringify({
    dayCount: await p.data("dayCount"),
    useGrid: await p.data("useGrid"),
    previewGrid: (await p.data("previewGrid"))?.length,
    error: await p.data("error"),
  }),
);
await miniProgram.screenshot({ path: join(shotDir, "07-share-week.png") });

// 7. 排班表管理
await miniProgram.navigateTo("/pages/schedules/index");
await sleep(2000);
p = await page("schedules");
console.log("schedules data:", JSON.stringify({ rules: (await p.data("rules"))?.length, error: await p.data("error") }));
await miniProgram.screenshot({ path: join(shotDir, "08-schedules.png") });

// 8. 新建循环排班
await miniProgram.navigateTo("/pages/cycle-create/index");
await sleep(2000);
p = await page("cycle-create");
console.log("cycle data:", JSON.stringify({ templates: (await p.data("templates"))?.length, error: await p.data("error") }));
await miniProgram.screenshot({ path: join(shotDir, "09-cycle.png") });

// 9. 班次管理
await miniProgram.navigateTo("/pages/shift-manage/index");
await sleep(2000);
p = await page("shift-manage");
console.log("shift-manage data:", JSON.stringify({ templates: (await p.data("templates"))?.length, error: await p.data("error") }));
await miniProgram.screenshot({ path: join(shotDir, "10-shift-manage.png") });

// 10. 改班记录（按月）
await miniProgram.navigateTo("/pages/change-records/index");
await sleep(2000);
p = await page("change-records");
console.log(
  "change-records data:",
  JSON.stringify({ month: await p.data("month"), records: (await p.data("records"))?.length, error: await p.data("error") }),
);
await miniProgram.screenshot({ path: join(shotDir, "11-change-records.png") });

// 11. 位置设置
await miniProgram.navigateTo("/pages/location/index");
await sleep(1500);
p = await page("location");
console.log("location data:", JSON.stringify({ location: await p.data("location") }));
await miniProgram.screenshot({ path: join(shotDir, "12-location.png") });

// 12. 提醒设置
await miniProgram.switchTab("/pages/notify/index");
await sleep(2000);
p = await page("notify");
console.log("notify data:", JSON.stringify({ prefs: await p.data("prefs"), error: await p.data("error") }));
await miniProgram.screenshot({ path: join(shotDir, "13-notify.png") });

// 13. 我的
await miniProgram.switchTab("/pages/me/index");
await sleep(1500);
p = await page("me");
console.log("me data:", JSON.stringify({ user: (await p.data("user"))?.displayName ?? null, workspace: (await p.data("workspace"))?.name ?? null }));
await miniProgram.screenshot({ path: join(shotDir, "14-me.png") });

console.log("走查完成，截图已保存到 artifacts/walkthrough/");
await miniProgram.close();
process.exit(0);

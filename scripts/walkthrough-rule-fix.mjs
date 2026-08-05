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

// 登录进入日历
await miniProgram.reLaunch("/pages/login/index");
await sleep(1500);
let p = await page("login");
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
await miniProgram.switchTab("/pages/calendar/index");
await sleep(2500);
p = await page("calendar");
const todayBefore = (await p.data("todaySummary"))?.shiftSnapshot?.name ?? null;
console.log("today before new rule:", todayBefore);

// 新建只含“休息”的排班表
await miniProgram.navigateTo("/pages/cycle-create/index");
await sleep(2000);
p = await page("cycle-create");
await p.callMethod("addSequence");
const templates = await p.data("templates");
const restTpl = templates.find((t) => t.kind === "rest");
await p.setData({
  ruleName: "临时覆盖验证",
  sequence: [
    {
      templateId: restTpl?.id ?? "",
      templateIndex: templates.indexOf(restTpl),
      name: restTpl?.name ?? "",
    },
  ],
});
await p.callMethod("submit");
await sleep(3000);
p = await page("after-submit");

// 日历：今天应被新规则覆盖为“休息”
await miniProgram.switchTab("/pages/calendar/index");
await sleep(2500);
p = await page("calendar");
const todayAfterNewRule = (await p.data("todaySummary"))?.shiftSnapshot?.name ?? null;
console.log("today after new rule:", todayAfterNewRule);
await miniProgram.screenshot({ path: join(shotDir, "09-calendar-new-rule-override.png") });

// 排班表管理：删除新规则
await miniProgram.navigateTo("/pages/schedules/index");
await sleep(2000);
p = await page("schedules");
let rules = await p.data("rules");
console.log("rules before delete:", JSON.stringify(rules.map((r) => ({ name: r.name, current: r.isCurrent }))));
const newRule = rules.find((r) => r.name === "临时覆盖验证");
await miniProgram.mockWxMethod("showModal", { confirm: true, cancel: false });
await p.callMethod("removeRule", {
  currentTarget: { dataset: { id: newRule?.id ?? "", name: newRule?.name ?? "" } },
});
await sleep(3000);
await miniProgram.restoreWxMethod("showModal");
p = await page("schedules-after-delete");
rules = await p.data("rules");
console.log("rules after delete new:", JSON.stringify(rules.map((r) => ({ name: r.name, current: r.isCurrent }))));

// 删除初始排班表，日历应清空
const initialRule = rules.find((r) => r.name === "初始排班表");
await miniProgram.mockWxMethod("showModal", { confirm: true, cancel: false });
await p.callMethod("removeRule", {
  currentTarget: { dataset: { id: initialRule?.id ?? "", name: initialRule?.name ?? "" } },
});
await sleep(3000);
await miniProgram.restoreWxMethod("showModal");
p = await page("schedules-after-initial-delete");
rules = await p.data("rules");
console.log("rules after delete initial:", rules.length);

await miniProgram.switchTab("/pages/calendar/index");
await sleep(2500);
p = await page("calendar");
const todayAfterAllDeleted = (await p.data("todaySummary")) ?? null;
const cellsWithShift = Object.keys(await p.data("shiftMap")).length;
console.log("calendar after delete all:", JSON.stringify({ today: todayAfterAllDeleted, cellsWithShift }));
await miniProgram.screenshot({ path: join(shotDir, "10-calendar-after-delete.png") });

console.log("rule fix walkthrough done");
miniProgram.disconnect();

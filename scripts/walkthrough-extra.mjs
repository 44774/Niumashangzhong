import automator from "miniprogram-automator";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = "D:\\ProgramFiles\\WeChatDeveloperTools\\cli.bat";
const projectPath = join(root, "apps", "miniprogram");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  execFileSync(
    "cmd.exe",
    ["/c", cliPath, "auto", "--project", projectPath, "--auto-port", "9420"],
    { stdio: "ignore", timeout: 30_000 },
  );
} catch {}
await sleep(2500);

const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });

// 虚拟规则班次详情（明天）
const tomorrow = new Date(Date.now() + 8 * 3600 * 1000 + 86400 * 1000).toISOString().slice(0, 10);
await miniProgram.reLaunch(`/pages/schedule-detail/index?date=${tomorrow}`);
await sleep(2500);
let p = await miniProgram.currentPage();
console.log(
  "virtual detail:",
  JSON.stringify({
    path: p?.path,
    detail: (await p.data("detail"))?.shiftSnapshot?.name ?? null,
    isVirtual: await p.data("isVirtual"),
    error: await p.data("error"),
  }),
);

// 远期无种子数据，应走规则本地计算
await miniProgram.reLaunch("/pages/schedule-detail/index?date=2026-09-10");
await sleep(2500);
p = await miniProgram.currentPage();
console.log(
  "virtual detail far:",
  JSON.stringify({
    detail: (await p.data("detail"))?.shiftSnapshot?.name ?? null,
    isVirtual: await p.data("isVirtual"),
    error: await p.data("error"),
  }),
);

// 排班表编辑预填
await miniProgram.reLaunch("/pages/schedules/index");
await sleep(2000);
p = await miniProgram.currentPage();
const rules = await p.data("rules");
console.log("rules:", rules?.length);
console.log("rules detail:", JSON.stringify(rules?.map((r) => ({ id: r.id, name: r.name, startDate: r.startDate, endDate: r.endDate, isCurrent: r.isCurrent }))));
const switchRuleId = rules?.[0]?.id;
if (switchRuleId) {
  await miniProgram.reLaunch("/pages/schedules/index");
  await sleep(2000);
  p = await miniProgram.currentPage();
  await p.callMethod("switchRule", { currentTarget: { dataset: { id: switchRuleId } } });
  await sleep(2500);
  console.log("rule.switch via UI: done");
}
await miniProgram.reLaunch("/pages/schedule-detail/index?date=2026-09-10");
await sleep(3000);
p = await miniProgram.currentPage();
console.log(
  "virtual detail after switch:",
  JSON.stringify({
    detail: (await p.data("detail"))?.shiftSnapshot?.name ?? null,
    isVirtual: await p.data("isVirtual"),
    error: await p.data("error"),
  }),
);
const ruleId = rules?.[0]?.id;
if (ruleId) {
  await miniProgram.navigateTo(`/pages/cycle-create/index?ruleId=${ruleId}`);
  await sleep(2000);
  p = await miniProgram.currentPage();
  console.log(
    "edit prefill:",
    JSON.stringify({
      editingId: await p.data("editingId"),
      ruleName: await p.data("ruleName"),
      startDate: await p.data("startDate"),
      sequence: (await p.data("sequence"))?.length,
      error: await p.data("error"),
    }),
  );
}

await miniProgram.close();
process.exit(0);

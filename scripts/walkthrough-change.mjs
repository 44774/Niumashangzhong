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
} catch {}
await sleep(2500);
mkdirSync(shotDir, { recursive: true });

const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

// 通过云函数创建一条今天的改班记录（改休息，避免冲突）
const created = await miniProgram.evaluate(
  (date) => {
    const call = (action, payload) =>
      new Promise((resolve) => {
        wx.cloud.callFunction({
          name: "api",
          data: { action, payload },
          success: (r) => resolve(r.result),
          fail: (e) => resolve({ ok: false, error: { message: e.errMsg } }),
        });
      });
    void (async () => {
      const ws = wx.getStorageSync("wc_workspace");
      const workspaceId = ws && ws.id ? ws.id : "";
      const list = await call("schedule.list", { workspaceId, from: date, to: date });
      const inst = list && list.ok && list.data ? list.data[0] : null;
      const change = inst
        ? await call("change.create", {
            workspaceId,
            scheduleInstanceId: inst.id,
            requestedShift: { name: "休息", kind: "rest", startTime: null, endTime: null, color: "#94A3B8" },
            reason: "走查验证",
          })
        : null;
      wx.setStorageSync("__diag_change", JSON.stringify({ change, workspaceId }));
    })();
    return "started";
  },
  today,
);
await sleep(6000);
const changeResult = await miniProgram.evaluate(() => {
  const raw = wx.getStorageSync("__diag_change") || "empty";
  return typeof raw === "string" && raw !== "empty" ? JSON.parse(raw) : raw;
});
console.log("change.create:", changeResult?.change?.ok === true ? "ok" : JSON.stringify(changeResult?.change));

// 日历：应出现改班标记
await miniProgram.reLaunch("/pages/calendar/index");
await sleep(3000);
let p = await miniProgram.currentPage();
console.log("calendar changeDates:", JSON.stringify(await p.data("changeDates")));
await miniProgram.screenshot({ path: join(shotDir, "15-calendar-change-mark.png") });

// 详情：当日改班记录
await miniProgram.navigateTo(`/pages/schedule-detail/index?date=${today}`);
await sleep(2500);
p = await miniProgram.currentPage();
console.log("detail changeRecords:", (await p.data("changeRecords"))?.length);
await miniProgram.screenshot({ path: join(shotDir, "16-detail-change.png") });

// 记录页按月
await miniProgram.navigateTo("/pages/change-records/index");
await sleep(2500);
p = await miniProgram.currentPage();
console.log("change-records:", JSON.stringify({ month: await p.data("month"), records: (await p.data("records"))?.length }));
await miniProgram.screenshot({ path: join(shotDir, "17-change-records.png") });

// 清理改班记录
const removed = await miniProgram.evaluate(
  (id) => {
    const call = (action, payload) =>
      new Promise((resolve) => {
        wx.cloud.callFunction({
          name: "api",
          data: { action, payload },
          success: (r) => resolve(r.result),
          fail: (e) => resolve({ ok: false, error: { message: e.errMsg } }),
        });
      });
    void (async () => {
      const ws = wx.getStorageSync("wc_workspace");
      const workspaceId = ws && ws.id ? ws.id : "";
      wx.setStorageSync("__diag_remove", JSON.stringify(await call("change.remove", { workspaceId, id })));
    })();
    return "started";
  },
  changeResult?.change?.data?.id ?? "",
);
await sleep(4000);
const removeResult = await miniProgram.evaluate(() => wx.getStorageSync("__diag_remove") || "empty");
console.log("change.remove:", typeof removeResult === "string" && removeResult !== "empty" ? removeResult : JSON.stringify(removeResult));

// 删除后日历标记应消失
await miniProgram.reLaunch("/pages/calendar/index");
await sleep(3000);
p = await miniProgram.currentPage();
console.log("calendar changeDates after delete:", JSON.stringify(await p.data("changeDates")));
await miniProgram.screenshot({ path: join(shotDir, "18-calendar-after-delete.png") });

await miniProgram.close();
process.exit(0);

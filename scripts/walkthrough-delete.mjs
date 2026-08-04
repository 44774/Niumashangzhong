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

const result = await miniProgram.evaluate(
  () => {
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
      const auth = await call("auth.me", { displayName: "走查" });
      const list = await call("change.list", { workspaceId, from: "2026-08-01", to: "2026-08-31", page: 1 });
      const records = list && list.ok ? list.data : [];
      const target = records.find((r) => r.businessDate === "2026-08-04") || records[0];
      const removed = target
        ? await call("change.remove", { workspaceId, id: target.id })
        : null;
      const after = await call("change.list", { workspaceId, from: "2026-08-01", to: "2026-08-31", page: 1 });
      wx.setStorageSync(
        "__diag_delete",
        JSON.stringify({
          authOk: auth?.ok === true,
          before: records.length,
          target: target ? { id: target.id, businessDate: target.businessDate } : null,
          removed,
          after: after && after.ok ? after.data.length : -1,
        }),
      );
    })();
    return "started";
  },
  "cloud1-d7gn5yyw2a7816ffd",
);
await sleep(8000);
const raw = await miniProgram.evaluate(() => wx.getStorageSync("__diag_delete") || "empty");
const out = typeof raw === "string" && raw !== "empty" ? JSON.parse(raw) : raw;
console.log("删除验证:", JSON.stringify(out));
console.log(
  out?.removed?.ok === true && out?.after === out?.before - 1
    ? "遗留改班记录删除成功"
    : "删除验证未通过",
);

await miniProgram.close();
process.exit(out?.removed?.ok === true && out?.after === out?.before - 1 ? 0 : 1);

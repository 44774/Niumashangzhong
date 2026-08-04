import automator from "miniprogram-automator";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = "D:\\ProgramFiles\\WeChatDeveloperTools\\cli.bat";
const projectPath = join(root, "apps", "miniprogram");

try {
  execFileSync(
    "cmd.exe",
    ["/c", cliPath, "auto", "--project", projectPath, "--auto-port", "9420"],
    { stdio: "ignore", timeout: 30_000 },
  );
} catch {
  // 已开启时忽略
}
await new Promise((r) => setTimeout(r, 2500));

const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });

await miniProgram.evaluate(
  (envId) => {
    wx.cloud.init({ env: envId, traceUser: true });
    const store = (value) => wx.setStorageSync("__diag_features", JSON.stringify(value));
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
      const auth = await call("auth.me", { displayName: "功能验证" });
      const workspaceId = auth && auth.ok ? auth.data.workspace.id : "";
      const holidaySync = await call("holiday.sync", { workspaceId });
      const holidayRange = await call("holiday.getRange", {
        workspaceId,
        from: "2026-09-30",
        to: "2026-10-08",
      });
      const weather = await call("weather.get", {
        workspaceId,
        from: "2026-08-05",
        to: "2026-08-05",
        location: { name: "深圳", latitude: 22.5431, longitude: 114.0579 },
      });
      const shifts = await call("shift.list", { workspaceId, active: true });
      const list = shifts && shifts.ok ? shifts.data : [];
      const tpl = list.find((t) => t.name === "早班") || list[0];
      let created = null;
      if (tpl) {
        created = await call("schedule.create", {
          workspaceId,
          businessDate: "2026-10-01",
          shiftTemplateId: tpl.id,
        });
        if (created && created.ok === false && created.error?.code === "SCHEDULE_CONFLICT") {
          created = { ok: true, existed: true };
        }
      }
      const share =
        created && created.ok
          ? await call("share.create", {
              workspaceId,
              rangeStart: "2026-10-01",
              rangeEnd: "2026-10-01",
              templateCode: "default",
              privacyOptions: {
                showDisplayName: true,
                showTime: true,
                showWeather: true,
                showLocation: false,
                showNote: false,
              },
            })
          : null;
      store({ auth, holidaySync, holidayRange, weather, created, share, workspaceId });
    })();
    return "started";
  },
  "cloud1-d7gn5yyw2a7816ffd",
);

await new Promise((r) => setTimeout(r, 30_000));
const raw = await miniProgram.evaluate(() => wx.getStorageSync("__diag_features") || "empty");
const result = typeof raw === "string" && raw !== "empty" ? JSON.parse(raw) : raw;

const holidayCount =
  result?.holidayRange && result.holidayRange.ok
    ? Object.keys(result.holidayRange.data ?? {}).length
    : 0;
const oct1 = result?.holidayRange?.data?.["2026-10-01"];
const weatherOk =
  result?.weather && result.weather.ok && Array.isArray(result.weather.data) && result.weather.data.length > 0;
const shareOvertime =
  result?.share && result.share.ok && result.share.data?.entries?.[0]?.overtime === true;

console.log("auth.me:", result?.auth?.ok === true ? "ok" : JSON.stringify(result?.auth));
console.log("holiday.getRange 2026-09-30..10-08 条数:", holidayCount, "| 10-01:", oct1);
console.log("weather.get 08-05:", weatherOk ? JSON.stringify(result.weather.data[0]) : JSON.stringify(result?.weather));
console.log("schedule.create 10-01:", result?.created?.ok === true ? "ok" : JSON.stringify(result?.created));
console.log("share.create 10-01 overtime:", shareOvertime ? "true" : JSON.stringify(result?.share));

const pass = holidayCount > 0 && oct1 === "holiday" && weatherOk && result?.created?.ok === true && shareOvertime;
console.log(pass ? "\n云端功能验证通过" : "\n云端功能验证失败");
await miniProgram.close();
process.exit(pass ? 0 : 1);

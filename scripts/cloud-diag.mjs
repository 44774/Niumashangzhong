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
await miniProgram.reLaunch("/pages/login/index");
await new Promise((r) => setTimeout(r, 2000));

const info = await miniProgram.evaluate(() => {
  const hasWx = typeof wx !== "undefined";
  const cloud = hasWx ? wx.cloud : null;
  return JSON.stringify({
    hasWx,
    hasCloud: !!cloud,
    hasInit: !!(cloud && cloud.init),
    hasCall: !!(cloud && cloud.callFunction),
    SDKVersion: hasWx ? wx.getSystemInfoSync().SDKVersion : "",
  });
});
console.log("DIAG:", info);

await miniProgram.evaluate(
  (envId) => {
    wx.cloud.init({ env: envId, traceUser: true });
    wx.cloud.callFunction({
      name: "api",
      data: { action: "system.ping" },
      success: (res) => wx.setStorageSync("__diag_ping", JSON.stringify(res.result)),
      fail: (err) => wx.setStorageSync("__diag_ping", `ERR: ${err.errMsg}`),
    });
    wx.cloud.callFunction({
      name: "api",
      data: { action: "auth.me", payload: { displayName: "诊断" } },
      success: (res) => wx.setStorageSync("__diag_auth", JSON.stringify(res.result)),
      fail: (err) => wx.setStorageSync("__diag_auth", `ERR: ${err.errMsg}`),
    });
    return "started";
  },
  "cloud1-d7gn5yyw2a7816ffd",
);
await new Promise((r) => setTimeout(r, 6000));

const ping = await miniProgram.evaluate(() => wx.getStorageSync("__diag_ping") || "empty");
const auth = await miniProgram.evaluate(() => wx.getStorageSync("__diag_auth") || "empty");
console.log("PING:", ping);
console.log("AUTH:", auth);

await miniProgram.close();
process.exit(0);

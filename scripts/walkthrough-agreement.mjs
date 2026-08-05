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

// 清空本地数据，模拟全新用户
await miniProgram.evaluate(() => {
  wx.clearStorageSync();
  return true;
});

// 1. 登录 → 应被强制进入协议确认页
await miniProgram.reLaunch("/pages/login/index");
await sleep(1500);
let p = await miniProgram.currentPage();
console.log("login path:", p?.path);
await p.callMethod("onWechatLogin");
await sleep(4000);
p = await miniProgram.currentPage();
console.log("after login path (expect privacy-agreement):", p?.path);
await miniProgram.screenshot({ path: join(shotDir, "11-agreement-first.png") });

// 2. 未滑动到底时点击同意不应生效
await p.callMethod("onAgree");
await sleep(1200);
const canAgreeBefore = await p.data("canAgree");
const storedBefore = await miniProgram.evaluate(() => wx.getStorageSync("wc_privacy_agreement_version"));
console.log("agree without scroll:", JSON.stringify({ path: (await miniProgram.currentPage())?.path, canAgree: canAgreeBefore, stored: storedBefore }));

// 3. 滑动到底 → 同意 → 进入日历并记录版本
await p.callMethod("onScrollToBottom");
await sleep(300);
await p.callMethod("onAgree");
await sleep(2500);
p = await miniProgram.currentPage();
const storedAfter = await miniProgram.evaluate(() => wx.getStorageSync("wc_privacy_agreement_version"));
console.log("after agree:", JSON.stringify({ path: p?.path, storedVersion: storedAfter }));
await miniProgram.screenshot({ path: join(shotDir, "12-agreement-consented.png") });

// 4. 模拟协议升级（本地版本回退）：重进日历应被自动带回协议页
await miniProgram.evaluate(() => wx.setStorageSync("wc_privacy_agreement_version", 0));
await miniProgram.reLaunch("/pages/calendar/index");
await sleep(3000);
p = await miniProgram.currentPage();
console.log("after version update path (expect privacy-agreement):", p?.path);
await miniProgram.screenshot({ path: join(shotDir, "13-agreement-updated.png") });

// 5. 不同意 → 清空会话并回登录页，无法使用
await miniProgram.mockWxMethod("showModal", { confirm: true, cancel: false });
await miniProgram.mockWxMethod("exitMiniProgram", function (opts) {
  if (opts && opts.success) opts.success({ errMsg: "exitMiniProgram:ok mock" });
});
await p.callMethod("onDisagree");
await sleep(1500);
await miniProgram.restoreWxMethod("showModal");
await miniProgram.restoreWxMethod("exitMiniProgram");
const finalPath = (await miniProgram.currentPage())?.path ?? "";
const token = await miniProgram.evaluate(() => wx.getStorageSync("wc_token"));
console.log("after disagree:", JSON.stringify({ path: finalPath, token, blocked: finalPath === "pages/privacy-agreement/index" && token === "" }));

console.log("agreement walkthrough done");
miniProgram.disconnect();

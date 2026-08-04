import automator from "miniprogram-automator";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = "D:\\ProgramFiles\\WeChatDeveloperTools\\cli.bat";
const projectPath = join(root, "apps", "miniprogram");
const artifactDir = join(root, "artifacts", "miniprogram-smoke");

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
await miniProgram.evaluate(() => wx.clearStorageSync());
await miniProgram.reLaunch("/pages/login/index");
await new Promise((r) => setTimeout(r, 1500));

const page = await miniProgram.currentPage();
await page.callMethod("onLocalLogin");
await new Promise((r) => setTimeout(r, 2000));

const token = await miniProgram.evaluate(() => wx.getStorageSync("wc_token") || "");
const mode = await miniProgram.evaluate(() => wx.getStorageSync("wc_login_mode") || "");
console.log(`未确认时 token="${token}" mode="${mode}"（应为空）`);

mkdirSync(artifactDir, { recursive: true });
await miniProgram.screenshot({ path: join(artifactDir, "local-login-modal.png") });
console.log(`弹窗截图: ${join(artifactDir, "local-login-modal.png")}`);

await miniProgram.close();
process.exit(token || mode ? 1 : 0);

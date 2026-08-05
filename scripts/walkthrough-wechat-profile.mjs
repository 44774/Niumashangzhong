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

await miniProgram.reLaunch("/pages/login/index");
await sleep(1500);

// 模拟微信返回昵称与头像
await miniProgram.mockWxMethod("getUserProfile", {
  userInfo: {
    nickName: "牛马测试",
    avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
  },
});

const p = await miniProgram.currentPage();
await p.callMethod("onWechatLogin");
await sleep(4000);
console.log("after wechat login:", (await miniProgram.currentPage())?.path);

await miniProgram.switchTab("/pages/me/index");
await sleep(2000);
const me = await miniProgram.currentPage();
const user = await me.data("user");
console.log(
  "me user after mock profile:",
  JSON.stringify({ displayName: user?.displayName, avatarUrl: user?.avatarUrl }),
);
await miniProgram.screenshot({ path: join(shotDir, "04-me-avatar.png") });

await miniProgram.restoreWxMethod("getUserProfile");
miniProgram.disconnect();
console.log("wechat profile walkthrough done");

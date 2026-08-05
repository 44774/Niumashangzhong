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

// 1. 登录页：品牌名与 logo
await miniProgram.reLaunch("/pages/login/index");
await sleep(1500);
let p = await page("login");
const brandEl = await p.$(".brand-name");
const logoEl = await p.$(".brand-logo-img");
const brandText = brandEl ? await brandEl.text() : null;
const logoSrc = logoEl ? await logoEl.attribute("src") : null;
console.log(
  "login brand:",
  JSON.stringify({
    brandText,
    logoExists: Boolean(logoEl),
    logoSrc,
  }),
);
await miniProgram.screenshot({ path: join(shotDir, "01-login-brand.png") });

// 2. 登录进入日历
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
await sleep(2500);

// 3. 我的页：版本号
await miniProgram.switchTab("/pages/me/index");
await sleep(1500);
p = await page("me");
console.log(
  "me brand:",
  JSON.stringify({
    appName: await p.data("appName"),
    version: await p.data("version"),
    footerText: (await p.$(".version")) ? await (await p.$(".version")).text() : null,
    user: (await p.data("user")) && {
      displayName: (await p.data("user")).displayName,
      avatarUrl: (await p.data("user")).avatarUrl,
    },
  }),
);
await miniProgram.screenshot({ path: join(shotDir, "02-me-brand.png") });

// 4. 关于与隐私页
await p.callMethod("showAbout");
await sleep(1500);
p = await page("about");
console.log(
  "about:",
  JSON.stringify({
    appName: await p.data("appName"),
    version: await p.data("version"),
    brandName: (await p.$(".brand-name")) ? await (await p.$(".brand-name")).text() : null,
    brandVersion: (await p.$(".brand-version"))
      ? await (await p.$(".brand-version")).text()
      : null,
    aboutText: (await p.$(".body")) ? (await (await p.$(".body")).text()).slice(0, 80) : null,
  }),
);
await miniProgram.screenshot({ path: join(shotDir, "03-about.png") });

await miniProgram.navigateBack();
await sleep(1000);
console.log("brand walkthrough done");
miniProgram.disconnect();

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

// 登录
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

// 我的 → 关于与隐私
await miniProgram.switchTab("/pages/me/index");
await sleep(1500);
p = await page("me");
await p.callMethod("showAbout");
await sleep(1500);
p = await page("about");
console.log(
  "about privacy rule:",
  JSON.stringify({
    rule: (await p.data("privacyRule"))?.slice(0, 60),
    items: (await p.data("privacyItems"))?.map((i) => i.title),
  }),
);
await miniProgram.screenshot({ path: join(shotDir, "05-about-privacy-rule.png") });
await miniProgram.navigateBack();
await sleep(1000);
p = await miniProgram.currentPage();

// 位置设置页：触发定位
await p.callMethod("goLocation");
await sleep(1500);
p = await page("location");
const popupTag = await p.$("privacy-popup");
console.log("privacy-popup component:", popupTag ? "present" : "missing");
await miniProgram.screenshot({ path: join(shotDir, "06-location.png") });

await p.callMethod("onAutoLocation");
await sleep(3000);
let pageMask = await p.$(".privacy-mask");
console.log("privacy popup visible after getLocation:", Boolean(pageMask));
if (pageMask) {
  await miniProgram.screenshot({ path: join(shotDir, "07-privacy-popup.png") });
}

if (!pageMask) {
  // 开发者工具未配置隐私指引时平台事件不会触发，直接显示组件验证 UI
  await miniProgram.callWxMethod("requirePrivacyAuthorize", {
    success: () => {},
    fail: () => {},
  });
  await sleep(2500);
  pageMask = await p.$(".privacy-mask");
  console.log("privacy popup after requirePrivacyAuthorize:", Boolean(pageMask));
}

if (!pageMask) {
  const shown = await miniProgram.evaluate(() => {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    const comp = page && page.selectComponent ? page.selectComponent("#privacy-popup") : null;
    if (comp && comp.setData) comp.setData({ visible: true });
    return Boolean(comp);
  });
  await sleep(1500);
  pageMask = await p.$(".privacy-mask");
  console.log("privacy popup via selectComponent:", shown, Boolean(pageMask));
  if (pageMask) {
    await miniProgram.screenshot({ path: join(shotDir, "07-privacy-popup.png") });
  }
}

let agreeTapped = false;
if (pageMask) {
  const agreeResult = await miniProgram.evaluate(() => {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    const comp = page && page.selectComponent ? page.selectComponent("#privacy-popup") : null;
    const hasMethod = Boolean(comp && typeof comp.onAgree === "function");
    if (comp && typeof comp.onAgree === "function") comp.onAgree();
    return {
      found: Boolean(comp),
      hasMethod,
      visibleAfter: comp && comp.data ? comp.data.visible : null,
    };
  });
  await sleep(1200);
  const after = await p.$(".privacy-mask");
  agreeTapped = agreeResult.hasMethod && !after;
  console.log("popup hidden after agree:", agreeTapped, JSON.stringify(agreeResult));
  await miniProgram.screenshot({ path: join(shotDir, "08-privacy-after-agree.png") });
}

console.log("privacy walkthrough done", { maskVisible: Boolean(pageMask), agreeTapped });
miniProgram.disconnect();

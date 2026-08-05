import automator from "miniprogram-automator";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = "D:\\ProgramFiles\\WeChatDeveloperTools\\cli.bat";
const projectPath = join(root, "apps", "miniprogram");
const wsEndpoint = "ws://127.0.0.1:9420";
const artifactDir = join(root, "artifacts", "miniprogram-smoke");
const apiBase = "http://127.0.0.1:3000/api/v1";
const cloudMode = /USE_CLOUDBASE\s*=\s*true/.test(
  readFileSync(join(root, "apps", "miniprogram", "config.ts"), "utf8"),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function ensureAutomation() {
  try {
    execFileSync(
      "cmd.exe",
      ["/c", cliPath, "auto", "--project", projectPath, "--auto-port", "9420"],
      { stdio: "ignore", timeout: 30_000 },
    );
  } catch {
    // 已开启时忽略失败
  }
  await sleep(2500);
}

async function backendUp() {
  try {
    const res = await fetch(`${apiBase}/auth/me`);
    return res.status === 401 || res.status === 200;
  } catch {
    return false;
  }
}

async function waitData(page, path, predicate, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await page.data(path);
    if (predicate(value)) return value;
    await sleep(500);
  }
  throw new Error(`等待页面数据超时: ${path}`);
}

mkdirSync(artifactDir, { recursive: true });
await ensureAutomation();

let miniProgram;
try {
  miniProgram = await automator.connect({ wsEndpoint });
  record("连接微信开发者工具", true, wsEndpoint);
} catch (err) {
  record("连接微信开发者工具", false, err.message);
  process.exit(1);
}

try {
  const backend = cloudMode || (await backendUp());
  record("后端可用", backend, cloudMode ? "CloudBase 模式" : apiBase);

  await miniProgram.reLaunch("/pages/login/index");
  await sleep(1200);
  let page = await miniProgram.currentPage();

  if (backend) {
    if (cloudMode) {
      const start = Date.now();
      try {
        await page.callMethod("onWechatLogin");
      } catch (err) {
        record("云登录触发", false, err.message);
      }
      while (Date.now() - start < 25_000) {
        page = await miniProgram.currentPage();
        if (page?.path === "pages/calendar/index") break;
        if (page?.path === "pages/privacy-agreement/index") {
          await page.callMethod("onScrollToBottom");
          await sleep(300);
          await page.callMethod("onAgree");
        }
        await sleep(1000);
      }
      record("云登录进入日历", page?.path === "pages/calendar/index", page?.path);
      try {
        await miniProgram.evaluate(() => {
          wx.cloud.callFunction({
            name: "api",
            data: { action: "system.seed" },
            success: (res) => wx.setStorageSync("__diag_seed", JSON.stringify(res.result)),
            fail: (err) => wx.setStorageSync("__diag_seed", `ERR: ${err.errMsg}`),
          });
          return "started";
        });
        await sleep(6000);
        const seedResult = await miniProgram.evaluate(
          () => wx.getStorageSync("__diag_seed") || "empty",
        );
        record(
          "演示数据初始化",
          !String(seedResult).startsWith("ERR") && String(seedResult) !== "empty",
          String(seedResult),
        );
        await miniProgram.reLaunch("/pages/calendar/index");
        await sleep(2500);
        page = await miniProgram.currentPage();
      } catch (err) {
        record("演示数据初始化", false, err.message);
      }
    } else {
      record("进入登录页", page?.path === "pages/login/index", page?.path);
      await page.setData({ displayName: "张小明" });
      await page.callMethod("onDevLogin");
      await sleep(3500);
      page = await miniProgram.currentPage();
      record("开发登录后进入日历", page?.path === "pages/calendar/index", page?.path);
    }

    const legend = await page.data("legend");
    record("月历加载班次图例", Array.isArray(legend) && legend.length > 0, `图例 ${legend?.length ?? 0} 项`);

    const cells = await page.data("cells");
    record("月历 42 格网格", Array.isArray(cells) && cells.length === 42);

    const todaySummary = await page.data("todaySummary");
    record("今日排班卡", Boolean(todaySummary), todaySummary?.shiftSnapshot?.name ?? "空状态");

    const today = todaySummary?.businessDate ?? (await page.data("selectedDate"));
    if (today) {
      await miniProgram.reLaunch(`/pages/schedule-detail/index?date=${today}`);
      await sleep(1500);
      page = await miniProgram.currentPage();
      const detail = await page.data("detail");
      record(
        "排班详情页",
        page?.path === "pages/schedule-detail/index",
        detail ? detail.shiftSnapshot.name : "无排班",
      );
      await miniProgram.screenshot({ path: join(artifactDir, "detail.png") });

      await miniProgram.reLaunch(`/pages/schedule-change/index?date=${today}`);
      await sleep(1500);
      page = await miniProgram.currentPage();
      const templates = await page.data("templates");
      record(
        "临时改班页加载模板",
        Array.isArray(templates) && templates.length > 0,
        `模板 ${templates?.length ?? 0} 个`,
      );
      await miniProgram.screenshot({ path: join(artifactDir, "change.png") });

      await miniProgram.reLaunch(`/pages/share/index?date=${today}`);
      await sleep(1500);
      page = await miniProgram.currentPage();
      const preview = await page.data("previewEntries");
      record("分享页生成预览", Array.isArray(preview), `条目 ${preview?.length ?? 0}`);
      await miniProgram.screenshot({ path: join(artifactDir, "share.png") });
    }

    await miniProgram.screenshot({ path: join(artifactDir, "calendar.png") });
  }
} catch (err) {
  record("冒烟流程", false, err.message);
} finally {
  await miniProgram.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length > 0 ? 1 : 0);

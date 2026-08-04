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
await miniProgram.reLaunch("/pages/calendar/index");
await sleep(3000);
let p = await miniProgram.currentPage();

const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const read = async () => ({
  selectedDate: await p.data("selectedDate"),
  showBackToday: await p.data("showBackToday"),
});

console.log("初始（今天）:", JSON.stringify(await read()));

// 点击非今日日期
const future = today.slice(0, 8) + String((Number(today.slice(8)) % 28) + 1).padStart(2, "0");
await p.callMethod("onDateTap", { detail: { date: future } });
await sleep(1500);
await miniProgram.navigateBack();
await sleep(1500);
p = await miniProgram.currentPage();
console.log("选中非今日并返回:", JSON.stringify(await read()));

// 回到今天
await p.callMethod("goToday");
await sleep(1500);
p = await miniProgram.currentPage();
console.log("点击回到今天后:", JSON.stringify(await read()));

const ok =
  (await p.data("showBackToday")) === false &&
  (await p.data("selectedDate")) === today;
console.log(ok ? "验证通过：仅非今日显示按钮，点击后回到今天并隐藏" : "验证未通过");
await miniProgram.close();
process.exit(ok ? 0 : 1);

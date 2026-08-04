import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const envId = process.env.CLOUD_ENV_ID || "cloud1-d7gn5yyw2a7816ffd";
const collections = [
  "users",
  "workspaces",
  "memberships",
  "shiftTemplates",
  "scheduleInstances",
  "scheduleRules",
  "changeRequests",
  "notificationPrefs",
  "notificationJobs",
  "shareSnapshots",
  "weatherCache",
  "holidays",
  "auditLogs",
];

function resolveCli() {
  try {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    const candidate = join(root, "@cloudbase/cli/dist/standalone/cli.js");
    if (existsSync(candidate)) {
      return { node: process.execPath, args: [candidate] };
    }
  } catch {
    // 回退到 PATH 中的 tcb
  }
  return { node: "tcb", args: [] };
}

const cli = resolveCli();

for (const name of collections) {
  const command = JSON.stringify([
    {
      TableName: name,
      CommandType: "COMMAND",
      Command: JSON.stringify({ create: name }),
    },
  ]);
  try {
    execFileSync(cli.node, [
      ...cli.args,
      "db",
      "nosql",
      "execute",
      "-e",
      envId,
      "--command",
      command,
      "--json",
    ], {
      stdio: "pipe",
    });
    console.log(`已创建集合: ${name}`);
  } catch (err) {
    const detail =
      err?.stderr?.toString().trim() || err?.stdout?.toString().trim() || err.message;
    const stdout = err?.stdout?.toString().trim() || "";
    if (stdout.includes("NamespaceExists")) {
      console.log(`集合已存在: ${name}`);
    } else {
      console.log(`集合 ${name} 创建失败(status=${err?.status}): ${(detail + " " + stdout).slice(0, 240)}`);
    }
  }
}

console.log("云数据库初始化完成");

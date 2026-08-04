import { execFileSync } from "node:child_process";

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
  "auditLogs",
];

for (const name of collections) {
  const command = JSON.stringify([
    {
      TableName: name,
      CommandType: "COMMAND",
      Command: JSON.stringify({ create: name }),
    },
  ]);
  try {
    execFileSync("tcb", ["db", "nosql", "execute", "-e", envId, "--command", command], {
      stdio: "pipe",
    });
    console.log(`已创建集合: ${name}`);
  } catch (err) {
    const detail = err?.stderr?.toString().trim() || err?.stdout?.toString().trim() || err.message;
    console.log(`集合 ${name} 跳过（可能已存在）: ${detail.slice(0, 200)}`);
  }
}

console.log("云数据库初始化完成（如需重试请先执行 tcb login）");

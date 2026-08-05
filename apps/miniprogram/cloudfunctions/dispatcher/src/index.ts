import cloud from "wx-server-sdk";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string });

const SHIFT_TEMPLATE_ID = process.env.SUBSCRIBE_SHIFT_TEMPLATE_ID || "";
const WEATHER_TEMPLATE_ID = process.env.SUBSCRIBE_WEATHER_TEMPLATE_ID || "";
const MINIPROGRAM_STATE = (process.env.SUBSCRIBE_MINIPROGRAM_STATE ||
  "formal") as "developer" | "trial" | "formal";
const PAGE = "pages/calendar/index";

function truncate(value: unknown, max = 20): string {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max) : text;
}

function templateFor(job: any): { templateId: string; name: string } | null {
  if (job.type === "shift_reminder") {
    return { templateId: SHIFT_TEMPLATE_ID, name: "上班提醒" };
  }
  if (job.type === "weather_reminder") {
    return { templateId: WEATHER_TEMPLATE_ID, name: "天气提醒" };
  }
  return null;
}

function buildData(job: any) {
  const payload = job.payload ?? {};
  const dateTime = `${payload.businessDate ?? ""} ${payload.startTime ?? ""}`.trim();
  const overtime = payload.overtime ? "（加班）" : "";
  if (job.type === "shift_reminder") {
    return {
      thing1: { value: truncate(payload.shiftName || "上班提醒") },
      time2: { value: truncate(dateTime, 20) },
      thing3: {
        value: truncate(`提前${payload.reminderMinutes ?? 15}分钟上班${overtime}`, 20),
      },
    };
  }
  return {
    thing1: { value: truncate("今日天气提醒") },
    time2: { value: truncate(dateTime, 20) },
    thing3: { value: truncate(`班次 ${payload.shiftName ?? ""}${overtime}`, 20) },
  };
}

async function sendJob(job: any, db: any): Promise<boolean> {
  const tpl = templateFor(job);
  const now = new Date().toISOString();
  if (job.ruleId) {
    const ruleRes = await db.collection("scheduleRules").doc(job.ruleId).get();
    const rule = ruleRes.data;
    if (!rule || rule.isActive === false) {
      await db.collection("notificationJobs").doc(job._id).update({
        data: { status: "cancelled", errorMessage: "排班表已删除或停用", processedAt: now },
      });
      return false;
    }
  }
  if (!tpl || !tpl.templateId) {
    await db.collection("notificationJobs").doc(job._id).update({
      data: { status: "failed", errorMessage: "订阅消息模板未配置", processedAt: now },
    });
    return false;
  }
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: job.openid,
      templateId: tpl.templateId,
      page: PAGE,
      data: buildData(job),
      miniprogramState: MINIPROGRAM_STATE,
    });
    await db.collection("notificationJobs").doc(job._id).update({
      data: { status: "sent", sentAt: now, processedAt: now },
    });
    return true;
  } catch (err: any) {
    const message = err?.errMsg || err?.message || String(err);
    console.error("[notify:subscribe:error]", job._id, message);
    await db.collection("notificationJobs").doc(job._id).update({
      data: { status: "failed", errorMessage: message, processedAt: now },
    });
    return false;
  }
}

exports.main = async () => {
  const db: any = cloud.database();
  const _ = db.command;
  const now = new Date().toISOString();
  const due = await db
    .collection("notificationJobs")
    .where({ status: "pending", triggerAt: _.lte(now) })
    .limit(20)
    .get();
  let processed = 0;
  let sent = 0;
  for (const job of due.data) {
    console.log("[notify:send]", job.type, JSON.stringify(job.payload ?? {}));
    if (await sendJob(job, db)) sent += 1;
    processed += 1;
  }
  return { processed, sent };
};

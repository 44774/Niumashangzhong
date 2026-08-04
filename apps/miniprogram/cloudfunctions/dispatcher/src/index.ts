import cloud from "wx-server-sdk";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string });

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
  for (const job of due.data) {
    // 开发通道：真实微信订阅消息在配置模板 ID 后接入
    console.log("[notify:dev]", job.type, JSON.stringify(job.payload ?? {}));
    await db
      .collection("notificationJobs")
      .doc(job._id)
      .update({ data: { status: "sent", sentAt: now } });
    processed += 1;
  }
  return { processed };
};

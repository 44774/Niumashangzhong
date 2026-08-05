"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// apps/miniprogram/cloudfunctions/dispatcher/src/index.ts
var import_wx_server_sdk = __toESM(require("wx-server-sdk"));
import_wx_server_sdk.default.init({ env: import_wx_server_sdk.default.DYNAMIC_CURRENT_ENV });
var SHIFT_TEMPLATE_ID = process.env.SUBSCRIBE_SHIFT_TEMPLATE_ID || "";
var WEATHER_TEMPLATE_ID = process.env.SUBSCRIBE_WEATHER_TEMPLATE_ID || "";
var MINIPROGRAM_STATE = process.env.SUBSCRIBE_MINIPROGRAM_STATE || "formal";
var PAGE = "pages/calendar/index";
function truncate(value, max = 20) {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max) : text;
}
function templateFor(job) {
  if (job.type === "shift_reminder") {
    return { templateId: SHIFT_TEMPLATE_ID, name: "\u4E0A\u73ED\u63D0\u9192" };
  }
  if (job.type === "weather_reminder") {
    return { templateId: WEATHER_TEMPLATE_ID || SHIFT_TEMPLATE_ID, name: "\u5929\u6C14\u63D0\u9192" };
  }
  return null;
}
function buildData(job) {
  const payload = job.payload ?? {};
  const dateTime = `${payload.businessDate ?? ""} ${payload.startTime ?? ""}`.trim();
  const overtime = payload.overtime ? "\uFF08\u52A0\u73ED\uFF09" : "";
  if (job.type === "shift_reminder") {
    return {
      thing1: { value: truncate(payload.shiftName || "\u4E0A\u73ED\u63D0\u9192") },
      time2: { value: truncate(dateTime, 20) },
      thing3: {
        value: truncate(`\u63D0\u524D${payload.reminderMinutes ?? 15}\u5206\u949F\u4E0A\u73ED${overtime}`, 20)
      }
    };
  }
  return {
    thing1: { value: truncate("\u4ECA\u65E5\u5929\u6C14\u63D0\u9192") },
    time2: { value: truncate(dateTime, 20) },
    thing3: { value: truncate(`\u73ED\u6B21 ${payload.shiftName ?? ""}${overtime}`, 20) }
  };
}
async function sendJob(job, db) {
  const tpl = templateFor(job);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (job.ruleId) {
    const ruleRes = await db.collection("scheduleRules").doc(job.ruleId).get();
    const rule = ruleRes.data;
    if (!rule || rule.isActive === false) {
      await db.collection("notificationJobs").doc(job._id).update({
        data: { status: "cancelled", errorMessage: "\u6392\u73ED\u8868\u5DF2\u5220\u9664\u6216\u505C\u7528", processedAt: now }
      });
      return false;
    }
  }
  if (!tpl || !tpl.templateId) {
    await db.collection("notificationJobs").doc(job._id).update({
      data: { status: "failed", errorMessage: "\u8BA2\u9605\u6D88\u606F\u6A21\u677F\u672A\u914D\u7F6E", processedAt: now }
    });
    return false;
  }
  try {
    await import_wx_server_sdk.default.openapi.subscribeMessage.send({
      touser: job.openid,
      templateId: tpl.templateId,
      page: PAGE,
      data: buildData(job),
      miniprogramState: MINIPROGRAM_STATE
    });
    await db.collection("notificationJobs").doc(job._id).update({
      data: { status: "sent", sentAt: now, processedAt: now }
    });
    return true;
  } catch (err) {
    const message = (err == null ? void 0 : err.errMsg) || (err == null ? void 0 : err.message) || String(err);
    console.error("[notify:subscribe:error]", job._id, message);
    await db.collection("notificationJobs").doc(job._id).update({
      data: { status: "failed", errorMessage: message, processedAt: now }
    });
    return false;
  }
}
exports.main = async () => {
  const db = import_wx_server_sdk.default.database();
  const _ = db.command;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const due = await db.collection("notificationJobs").where({ status: "pending", triggerAt: _.lte(now) }).limit(20).get();
  let processed = 0;
  let sent = 0;
  for (const job of due.data) {
    console.log("[notify:send]", job.type, JSON.stringify(job.payload ?? {}));
    if (await sendJob(job, db)) sent += 1;
    processed += 1;
  }
  return { processed, sent };
};

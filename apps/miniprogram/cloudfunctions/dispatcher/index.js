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
exports.main = async () => {
  const db = import_wx_server_sdk.default.database();
  const _ = db.command;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const due = await db.collection("notificationJobs").where({ status: "pending", triggerAt: _.lte(now) }).limit(20).get();
  let processed = 0;
  for (const job of due.data) {
    console.log("[notify:dev]", job.type, JSON.stringify(job.payload ?? {}));
    await db.collection("notificationJobs").doc(job._id).update({ data: { status: "sent", sentAt: now } });
    processed += 1;
  }
  return { processed };
};

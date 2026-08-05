import cloud from "wx-server-sdk";
import { ensureUserAndWorkspace } from "./db";
import { toUser, toWorkspace } from "./map";
import { fail, ok, CloudError } from "./util";
import * as shift from "./shift";
import * as schedule from "./schedule";
import * as change from "./change";
import * as weather from "./weather";
import * as notify from "./notify";
import * as share from "./share";
import { seedDemo } from "./seed";
import * as holiday from "./holiday";
import * as user from "./user";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string });

exports.main = async (event: any) => {
  const { OPENID } = cloud.getWXContext();
  const action: string | undefined = event?.action;
  const payload: any = event?.payload ?? {};
  if (!action) {
    return fail(new CloudError("VALIDATION_ERROR", "缺少 action"));
  }
  if (!OPENID && action !== "system.ping") {
    return fail(new CloudError("UNAUTHORIZED", "请先登录", 401));
  }
  const openid: string = OPENID ?? "";
  try {
    switch (action) {
      case "system.ping":
        return ok({ pong: true });
      case "system.seed":
        return ok(await seedDemo(openid));
      case "auth.me": {
        const ctx = await ensureUserAndWorkspace(openid, payload.displayName, payload.avatarUrl);
        return ok({ user: toUser(ctx.user), workspace: toWorkspace(ctx.workspace) });
      }
      case "workspaces.list": {
        const ctx = await ensureUserAndWorkspace(openid);
        return ok([toWorkspace(ctx.workspace)]);
      }
      case "shift.list":
        return ok(await shift.list(openid, payload));
      case "shift.create":
        return ok(await shift.create(openid, payload));
      case "shift.update":
        return ok(await shift.update(openid, payload));
      case "schedule.list":
        return ok(await schedule.list(openid, payload));
      case "schedule.create":
        return ok(await schedule.create(openid, payload));
      case "schedule.detail":
        return ok(await schedule.detail(openid, payload));
      case "schedule.update":
        return ok(await schedule.update(openid, payload));
      case "rule.create":
        return ok(await schedule.createRule(openid, payload));
      case "rule.update":
        return ok(await schedule.updateRule(openid, payload.workspaceId, payload));
      case "rule.list":
        return ok(await schedule.listRules(openid, payload.workspaceId));
      case "rule.switch":
        return ok(await schedule.switchRule(openid, payload.workspaceId, payload.ruleId));
      case "rule.remove":
        return ok(await schedule.removeRule(openid, payload.workspaceId, payload.ruleId));
      case "change.create":
        return ok(await change.create(openid, payload));
      case "change.list":
        return ok(await change.list(openid, payload));
      case "change.remove":
        return ok(await change.remove(openid, payload));
      case "weather.get":
        return ok(await weather.get(openid, payload));
      case "holiday.sync":
        return ok(await holiday.sync(openid, payload));
      case "holiday.getRange":
        return ok(await holiday.getRange(openid, payload));
      case "user.updateLocation":
        return ok(await user.updateLocation(openid, payload));
      case "notify.get":
        return ok(await notify.get(openid, payload));
      case "notify.save":
        return ok(await notify.save(openid, payload));
      case "notify.templates":
        return ok(notify.templates());
      case "notify.subscribe":
        return ok(await notify.subscribe(openid, payload));
      case "notify.scheduleRuleJobs":
        return ok(await notify.scheduleRuleJobs(openid, payload));
      case "share.create":
        return ok(await share.create(openid, payload));
      default:
        return fail(new CloudError("NOT_FOUND", `未知 action: ${action}`, 404));
    }
  } catch (err) {
    return fail(err);
  }
};

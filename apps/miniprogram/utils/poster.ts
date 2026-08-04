import type { ShareSnapshot } from "../typings/api";

const WIDTH = 1080;
const ROW_HEIGHT = 150;
const HEADER_HEIGHT = 300;
const FOOTER_HEIGHT = 160;

export function posterHeight(snapshot: ShareSnapshot): number {
  return HEADER_HEIGHT + Math.max(1, snapshot.entries.length) * ROW_HEIGHT + FOOTER_HEIGHT;
}

export function drawPoster(
  snapshot: ShareSnapshot,
  callback: (error: Error | null, tempFilePath?: string) => void,
): void {
  const query = wx.createSelectorQuery();
  query
    .select("#posterCanvas")
    .fields({ node: true, size: true })
    .exec((res) => {
      const target = res[0] as
        | { node: WechatMiniprogram.Canvas; width: number; height: number }
        | undefined;
      if (!target?.node) {
        callback(new Error("海报画布初始化失败"));
        return;
      }
      const canvas = target.node;
      const ctx = canvas.getContext("2d");
      const height = posterHeight(snapshot);
      const dpr = 1;
      canvas.width = WIDTH * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // 背景
      ctx.fillStyle = "#F5F9FF";
      ctx.fillRect(0, 0, WIDTH, height);

      // 头部
      ctx.fillStyle = "#1F6FEB";
      ctx.fillRect(0, 0, WIDTH, HEADER_HEIGHT);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 64px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("工作日历 · 我的班表", 64, 110);
      ctx.font = "36px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(`${snapshot.rangeStart} 至 ${snapshot.rangeEnd}`, 64, 180);
      if (snapshot.ownerDisplayName) {
        ctx.fillText(`分享人：${snapshot.ownerDisplayName}`, 64, 240);
      }

      // 班次行
      let y = HEADER_HEIGHT + 40;
      for (const entry of snapshot.entries) {
        ctx.fillStyle = "#FFFFFF";
        roundRect(ctx, 40, y, WIDTH - 80, ROW_HEIGHT - 24, 20);
        ctx.fill();

        ctx.fillStyle = entry.color;
        ctx.fillRect(64, y + 28, 18, 74);

        ctx.fillStyle = "#14213D";
        ctx.font = "bold 44px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(entry.date.slice(5), 108, y + 78);

        ctx.fillStyle = "#1F6FEB";
        ctx.font = "bold 44px sans-serif";
        ctx.fillText(entry.shiftName, 280, y + 78);

        const rightParts: string[] = [];
        if (entry.timeText) rightParts.push(entry.timeText);
        if (entry.weather) {
          rightParts.push(
            `${entry.weather.conditionText} ${entry.weather.temperatureMin}~${entry.weather.temperatureMax}°`,
          );
        }
        if (rightParts.length > 0) {
          ctx.fillStyle = "#5B6B82";
          ctx.font = "32px sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(rightParts.join("  "), WIDTH - 72, y + 78);
        }

        const subParts: string[] = [];
        if (entry.location) subParts.push(`地点：${entry.location}`);
        if (entry.note) subParts.push(`备注：${entry.note}`);
        if (subParts.length > 0) {
          ctx.fillStyle = "#8A98AA";
          ctx.font = "28px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(subParts.join("  ").slice(0, 40), 108, y + 122);
        }
        y += ROW_HEIGHT;
      }

      // 页脚
      ctx.fillStyle = "#8A98AA";
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("分享快照不含手机号、精确地址与内部备注", WIDTH / 2, height - 80);
      ctx.fillText("由“工作日历”小程序生成", WIDTH / 2, height - 34);

      wx.canvasToTempFilePath({
        canvas,
        success: (res) => callback(null, res.tempFilePath),
        fail: () => callback(new Error("海报导出失败，请重试")),
      });
    });
}

function roundRect(
  ctx: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

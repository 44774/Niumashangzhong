import type { ShareSnapshot } from "../typings/api";
import { rangeDaysCount } from "./share-range";

const WIDTH = 1080;
const ROW_HEIGHT = 150;
const HEADER_HEIGHT = 300;
const FOOTER_HEIGHT = 160;

export interface CalendarGridCell {
  date: string;
  day: number;
  inRange: boolean;
  shiftName?: string;
  shortName?: string;
  color?: string;
  overtime?: boolean;
  weatherText?: string;
}

const CELL_W = 137;
const CELL_H = 150;
const GRID_LEFT = 60;
const WEEKDAY_H = 80;
const HEADER_H = 240;
const LEGEND_H = 90;

function weekdayOffset(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return (wd + 6) % 7; // 周一 = 0
}

export function buildCalendarGrid(
  rangeStart: string,
  rangeEnd: string,
  entries: ShareSnapshot["entries"],
): CalendarGridCell[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const offset = weekdayOffset(rangeStart);
  const total = rangeDaysCount(rangeStart, rangeEnd);
  const cells: CalendarGridCell[] = [];
  for (let i = 0; i < offset; i += 1) {
    cells.push({ date: "", day: 0, inRange: false });
  }
  let cursor = rangeStart;
  for (let i = 0; i < total; i += 1) {
    const entry = byDate.get(cursor);
    cells.push({
      date: cursor,
      day: Number(cursor.slice(8, 10)),
      inRange: true,
      shiftName: entry?.shiftName,
      shortName: entry?.shortName,
      color: entry?.color,
      overtime: entry?.overtime,
      weatherText: entry?.weather ? entry.weather.conditionText : undefined,
    });
    const [y, m, d] = cursor.split("-").map(Number);
    const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1));
    cursor = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
      dt.getUTCDate(),
    ).padStart(2, "0")}`;
  }
  return cells;
}

export function calendarPosterHeight(rangeStart: string, rangeEnd: string): number {
  const offset = weekdayOffset(rangeStart);
  const total = rangeDaysCount(rangeStart, rangeEnd);
  const weeks = Math.ceil((offset + total) / 7);
  return HEADER_H + WEEKDAY_H + weeks * CELL_H + LEGEND_H + FOOTER_HEIGHT;
}

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

export function drawCalendarPoster(
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
      const height = calendarPosterHeight(snapshot.rangeStart, snapshot.rangeEnd);
      canvas.width = WIDTH;
      canvas.height = height;

      ctx.fillStyle = "#F5F9FF";
      ctx.fillRect(0, 0, WIDTH, height);

      // 头部
      ctx.fillStyle = "#1F6FEB";
      ctx.fillRect(0, 0, WIDTH, HEADER_H);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 64px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("工作日历 · 我的班表", 64, 90);
      ctx.font = "36px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(`${snapshot.rangeStart} 至 ${snapshot.rangeEnd}`, 64, 160);
      if (snapshot.ownerDisplayName) {
        ctx.fillText(`分享人：${snapshot.ownerDisplayName}`, 64, 215);
      }

      // 周标题
      ctx.fillStyle = "#5B6B82";
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ["一", "二", "三", "四", "五", "六", "日"].forEach((label, i) => {
        ctx.fillText(label, GRID_LEFT + CELL_W * i + CELL_W / 2, HEADER_H + 50);
      });

      const cells = buildCalendarGrid(snapshot.rangeStart, snapshot.rangeEnd, snapshot.entries);
      cells.forEach((cell, index) => {
        const row = Math.floor(index / 7);
        const col = index % 7;
        const x = GRID_LEFT + col * CELL_W;
        const y = HEADER_H + WEEKDAY_H + row * CELL_H;
        if (!cell.inRange) return;

        // 日期数字
        ctx.fillStyle = "#14213D";
        ctx.font = "bold 30px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(String(cell.day), x + 10, y + 34);

        // 班次块
        if (cell.shiftName && cell.color) {
          roundRect(ctx, x + 6, y + 46, CELL_W - 12, 56, 10);
          ctx.fillStyle = `${cell.color}1A`;
          ctx.fill();
          ctx.fillStyle = cell.color;
          ctx.font = "bold 28px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(cell.shiftName.slice(0, 4), x + CELL_W / 2, y + 84);
          if (cell.overtime) {
            ctx.fillStyle = "#EF4444";
            ctx.font = "bold 22px sans-serif";
            ctx.textAlign = "right";
            ctx.fillText("加班", x + CELL_W - 12, y + 40);
          }
        }

        // 天气摘要
        if (cell.weatherText) {
          ctx.fillStyle = "#8A98AA";
          ctx.font = "22px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(cell.weatherText, x + CELL_W / 2, y + 128);
        }
      });

      // 图例
      const legendY = HEADER_H + WEEKDAY_H + Math.ceil(cells.length / 7) * CELL_H + 30;
      const legendItems = Array.from(
        new Map(
          snapshot.entries.map((e) => [e.color, { color: e.color, name: e.shiftName }]),
        ).values(),
      );
      ctx.textAlign = "left";
      let legendX = GRID_LEFT;
      for (const item of legendItems) {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY, 24, 24);
        ctx.fillStyle = "#5B6B82";
        ctx.font = "26px sans-serif";
        ctx.fillText(item.name, legendX + 34, legendY + 22);
        legendX += 34 + ctx.measureText(item.name).width + 40;
      }
      if (legendItems.length === 0) {
        ctx.fillStyle = "#8A98AA";
        ctx.font = "26px sans-serif";
        ctx.fillText("该范围内暂无排班", GRID_LEFT, legendY + 22);
      }

      // 页脚
      ctx.fillStyle = "#8A98AA";
      ctx.font = "26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("分享快照不含手机号、精确地址与内部备注", WIDTH / 2, height - 90);
      ctx.fillText("由“工作日历”小程序生成", WIDTH / 2, height - 46);

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

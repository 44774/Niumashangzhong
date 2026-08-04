import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { requireAuth, requireWorkspace } from "../../lib/auth.js";
import { validationError } from "../../lib/errors.js";
import type { WeatherService } from "../../lib/weather.js";
import { validateBusinessDate } from "../../lib/snapshot.js";

export async function weatherRoutes(
  app: FastifyInstance,
  opts: { db: Db; weather: WeatherService },
): Promise<void> {
  const { db, weather } = opts;
  app.get<{ Querystring: { from: string; to: string; city?: string } }>(
    "/weather",
    { schema: { tags: ["Weather"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const { from, to } = req.query;
      if (!from || !to) throw validationError("from 与 to 为必填日期");
      validateBusinessDate(from);
      validateBusinessDate(to);
      if (from > to) throw validationError("from 不能晚于 to");
      const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const city = req.query.city?.trim() || userRow[0]?.defaultCity || "深圳";
      return weather.getRange(city, from, to, ws.timezone);
    },
  );
}

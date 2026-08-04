export interface AppConfig {
  port: number;
  databaseUrl: string;
  databaseUrlTest: string;
  jwtSecret: string;
  wechatAppId: string;
  wechatSecret: string;
  weatherProvider: string;
  env: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl:
      process.env.DATABASE_URL ?? "postgres://workcal:workcal_dev@127.0.0.1:5432/workcal",
    databaseUrlTest:
      process.env.DATABASE_URL_TEST ??
      "postgres://workcal:workcal_dev@127.0.0.1:5432/workcal_test",
    jwtSecret: process.env.JWT_SECRET ?? "dev-only-jwt-secret-change-me",
    wechatAppId: process.env.WECHAT_APPID ?? "",
    wechatSecret: process.env.WECHAT_SECRET ?? "",
    weatherProvider: process.env.WEATHER_PROVIDER ?? "mock",
    env: process.env.NODE_ENV ?? "development",
  };
}

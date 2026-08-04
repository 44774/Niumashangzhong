import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tokens = JSON.parse(readFileSync(join(root, "packages/design-tokens/tokens.json"), "utf8"));

const lines = [];
lines.push("/* 由 packages/design-tokens/tokens.json 生成，请勿手改。运行 pnpm gen:tokens 重新生成 */");
lines.push("page {");
for (const [group, values] of Object.entries(tokens)) {
  if (group === "breakpoint") continue;
  if (group === "motion") continue;
  if (group === "zIndex") continue;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "object" && value !== null) {
      for (const [sub, v] of Object.entries(value)) {
        lines.push(`  --wc-${group}-${key}-${sub}: ${v};`);
      }
    } else {
      lines.push(`  --wc-${group}-${key}: ${value};`);
    }
  }
}
lines.push("}");
lines.push("");

const target = join(root, "apps/miniprogram/styles/tokens.wxss");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, lines.join("\n"), "utf8");
console.log(`已生成 ${target}`);

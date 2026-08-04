import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "packages/shared-types/src/index.ts");
const targetDir = join(root, "apps/miniprogram/typings");
mkdirSync(targetDir, { recursive: true });

// 小程序端只消费类型：复制主类型文件，并在文件头加注释说明来源。
const content = readFileSync(src, "utf8");
copyFileSync(src, join(targetDir, "api.ts"));

// 小程序 tsconfig 需要把这些类型包含进编译
const tsconfigPath = join(root, "apps/miniprogram/tsconfig.json");
const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths ?? {};
tsconfig.compilerOptions.paths["@wc/types"] = ["./typings/api.ts"];
writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n", "utf8");

console.log(`已同步共享类型到 ${join(targetDir, "api.ts")}（${content.split("\n").length} 行）`);

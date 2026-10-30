import { build } from "esbuild";
import { mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const distDir = join(__dirname, "dist");
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  // Un solo archivo JS autocontenido (sin dependencias nativas): se puede
  // publicar como release y el instalador solo descarga index.js.
  await build({
    entryPoints: [join(__dirname, "src/index.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: join(distDir, "index.js"),
    banner: {
      js: [
        "#!/usr/bin/env node",
        'import { createRequire as __opCreateRequire } from "node:module";',
        "const require = __opCreateRequire(import.meta.url);",
      ].join("\n"),
    },
    sourcemap: false,
    minify: false,
    legalComments: "none",
  });

  console.log("Build completado: dist/index.js");
}

main().catch((e) => {
  console.error("Build falló:", e);
  process.exit(1);
});

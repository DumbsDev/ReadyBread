import { readdirSync, statSync, existsSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";

const resolveResourceDir = () => {
  const argDir = process.argv[2];
  if (argDir) return path.resolve(argDir);

  const envDir = process.env.RESOURCE_DIR;
  if (envDir) return path.resolve(envDir);

  return path.join(process.cwd(), "functions");
};

const resourceDir = resolveResourceDir();
const srcDir = path.join(resourceDir, "src");
const libDir = path.join(resourceDir, "lib");
const buildInfoPath = path.join(resourceDir, "tsconfig.tsbuildinfo");

const latestMtime = (target) => {
  if (!existsSync(target)) return 0;

  const stats = statSync(target);
  if (!stats.isDirectory()) return stats.mtimeMs;

  let latest = 0;
  const entries = readdirSync(target, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "lib" || entry.name === ".git") {
      continue; // skip heavy/derived folders
    }

    const childPath = path.join(target, entry.name);
    latest = Math.max(latest, latestMtime(childPath));
  }

  return latest;
};

const needsBuild = () => {
  // If we have no compiled output, always build.
  if (!existsSync(libDir)) return true;

  const srcStamp = latestMtime(srcDir);
  const buildInfoStamp = existsSync(buildInfoPath)
    ? statSync(buildInfoPath).mtimeMs
    : 0;
  const libStamp = latestMtime(libDir);
  const compiledStamp = Math.max(buildInfoStamp, libStamp);

  // If there is no source stamp, fall back to rebuilding.
  if (srcStamp === 0) return true;

  return srcStamp > compiledStamp;
};

const buildFunctions = () => {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, ["run", "build"], {
    cwd: resourceDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    const code = result.status ?? 1;
    console.error(`functions: build failed with code ${code}`);
    process.exit(code);
  }
};

try {
  if (needsBuild()) {
    console.log(`functions: building (${resourceDir})`);
    buildFunctions();
  } else {
    console.log("functions: build skipped (no src changes detected).");
  }
} catch (err) {
  console.error("functions: predeploy build check failed.", err);
  process.exit(1);
}

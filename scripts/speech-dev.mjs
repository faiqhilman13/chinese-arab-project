import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const skipInstall = args.has("--skip-install");
const rootDir = resolve(import.meta.dirname, "..");
const serviceDir = resolve(rootDir, "speech-service");
const venvDir = resolve(serviceDir, ".venv");

function parseDotEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const content = readFileSync(path, "utf8");
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

const rootEnvPath = resolve(rootDir, ".env");
const serviceEnvPath = resolve(serviceDir, ".env");
const mergedEnv = {
  ...process.env,
  ...parseDotEnvFile(rootEnvPath),
  ...parseDotEnvFile(serviceEnvPath),
};

function runOrThrow(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: serviceDir,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${result.status}.`);
  }
}

function commandWorks(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: serviceDir,
    stdio: "ignore",
    shell: false,
  });
  return result.status === 0;
}

function resolveBootstrapPython() {
  const requested = process.env.PYTHON_BIN;
  if (requested && commandWorks(requested, ["--version"])) {
    return requested;
  }

  const candidates =
    process.platform === "win32"
      ? ["py", "python", "python3"]
      : ["python3", "python", "py"];

  for (const command of candidates) {
    if (commandWorks(command, ["--version"])) {
      return command;
    }
  }

  throw new Error(
    "No Python interpreter found. Install Python 3.10+ and ensure `python` (or `py`) is in PATH.",
  );
}

function resolveVenvPython() {
  return process.platform === "win32"
    ? resolve(venvDir, "Scripts", "python.exe")
    : resolve(venvDir, "bin", "python");
}

function ensureVenv() {
  const venvPython = resolveVenvPython();
  if (existsSync(venvPython)) {
    return venvPython;
  }

  const bootstrapPython = resolveBootstrapPython();
  runOrThrow(bootstrapPython, ["-m", "venv", venvDir]);
  return resolveVenvPython();
}

function installDeps(venvPython) {
  runOrThrow(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
  runOrThrow(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"]);
}

function runServer(venvPython) {
  const child = spawn(
    venvPython,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001", "--reload"],
    {
      cwd: serviceDir,
      stdio: "inherit",
      shell: false,
      env: mergedEnv,
    },
  );

  const stop = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

const venvPython = ensureVenv();

if (checkOnly) {
  console.log(JSON.stringify({ serviceDir, venvDir, venvPython }, null, 2));
  process.exit(0);
}

if (!skipInstall) {
  installDeps(venvPython);
}

runServer(venvPython);

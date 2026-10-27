import { spawn } from "node:child_process";

export async function runWithOutput(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) =>
      reject(new Error(`Could not start ${command}: ${error.message}. Is it installed and on PATH?`)),
    );
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with code ${code}\n${stderr.trim()}`));
    });
  });
}

export async function runCapture(command: string, args: string[]): Promise<string> {
  return (await runWithOutput(command, args)).stdout;
}

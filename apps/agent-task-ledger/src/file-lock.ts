import * as fs from "fs";
import * as path from "path";

export class FileLock {
  private lockPath: string;
  private locked = false;

  constructor(filePath: string) {
    this.lockPath = filePath + ".lock";
  }

  async acquire(): Promise<void> {
    const maxRetries = 50;
    const retryDelay = 10; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try to create lock file exclusively
        const fd = fs.openSync(this.lockPath, "wx");
        fs.writeSync(fd, String(process.pid));
        fs.closeSync(fd);
        this.locked = true;
        return;
      } catch (err: any) {
        if (err.code === "EEXIST") {
          // Lock file exists — check if stale
          try {
            const content = fs.readFileSync(this.lockPath, "utf8");
            const lockPid = parseInt(content, 10);
            if (!isNaN(lockPid)) {
              try {
                // Check if process is still alive
                process.kill(lockPid, 0);
              } catch {
                // Process is dead — stale lock, remove it
                fs.unlinkSync(this.lockPath);
                continue;
              }
            }
          } catch {
            // Can't read lock file — wait and retry
          }
          await new Promise((r) => setTimeout(r, retryDelay));
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Failed to acquire lock after ${maxRetries} retries: ${this.lockPath}`);
  }

  release(): void {
    if (this.locked) {
      try {
        fs.unlinkSync(this.lockPath);
      } catch {
        // Best effort
      }
      this.locked = false;
    }
  }
}

export async function atomicAppend(
  filePath: string,
  data: string
): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = filePath + ".tmp." + process.pid;

  // If file doesn't exist, create it atomically
  if (!fs.existsSync(filePath)) {
    try {
      const fd = fs.openSync(filePath, "wx");
      fs.writeSync(fd, data);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      return;
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
      // File was created by another process — fall through to append
    }
  }

  // Read existing content, append new data, write to temp, rename
  const existing = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(tmpPath, existing + data, "utf8");

  // fsync the temp file
  const fd = fs.openSync(tmpPath, "r+");
  fs.fsyncSync(fd);
  fs.closeSync(fd);

  // Atomic rename
  fs.renameSync(tmpPath, filePath);
}

export async function lockAndAppend(
  filePath: string,
  data: string
): Promise<void> {
  const lock = new FileLock(filePath);
  await lock.acquire();
  try {
    await atomicAppend(filePath, data);
  } finally {
    lock.release();
  }
}

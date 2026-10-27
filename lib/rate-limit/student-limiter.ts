import { AppError } from "@/lib/errors/app-error";

// In-memory token bucket / sliding window cache for student verification per IP
const studentVerifyCache = new Map<string, number[]>();
const MAX_VERIFICATIONS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

export function checkStudentVerifyRateLimit(ip: string): void {
  const now = Date.now();
  const timestamps = studentVerifyCache.get(ip) || [];

  // Filter timestamps within window
  const activeTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (activeTimestamps.length >= MAX_VERIFICATIONS) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many attempts. Please try again in 1 minute."
    );
  }

  activeTimestamps.push(now);
  studentVerifyCache.set(ip, activeTimestamps);

  // Periodic cleanup if cache grows
  if (studentVerifyCache.size > 10000) {
    for (const [key, times] of studentVerifyCache.entries()) {
      const valid = times.filter((t) => now - t < WINDOW_MS);
      if (valid.length === 0) {
        studentVerifyCache.delete(key);
      } else {
        studentVerifyCache.set(key, valid);
      }
    }
  }
}

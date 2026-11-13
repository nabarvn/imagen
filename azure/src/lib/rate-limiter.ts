import { redis } from "./redis";
import { Ratelimit } from "@upstash/ratelimit";
import { HttpRequest, HttpResponseInit } from "@azure/functions";

const DAILY_USAGE_LIMIT = 2;

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "@upstash/ratelimit",
  ephemeralCache: false,
});

export const applyRateLimiter = async (
  limiter: Ratelimit,
  request: HttpRequest,
): Promise<HttpResponseInit | null> => {
  const fingerprint = request.headers.get("x-fingerprint") as string;
  const forwardedFor = request.headers.get("x-forwarded-for");

  const identifier =
    fingerprint || forwardedFor?.split(",")[0].trim() || "127.0.0.1";

  try {
    const { success, limit, remaining } = await limiter.limit(identifier);

    console.log(
      `Rate limit status for ${identifier}. Remaining: ${remaining} of ${limit}.`,
    );

    if (!success) {
      console.log(`Rate limit EXCEEDED for ${identifier}.`);

      const errorMessage =
        "You are sending requests too quickly. Please wait a moment.";

      return {
        status: 429,
        jsonBody: {
          error: errorMessage,
        },
      };
    }

    return null;
  } catch (error) {
    console.error("Rate limiter error:", error);

    return {
      status: 500,
      jsonBody: {
        error: "Internal Server Error.",
      },
    };
  }
};

export const checkUsageStatus = async (
  request: HttpRequest,
): Promise<{ isAtLimit: boolean; identifier: string; ttl: number | null }> => {
  const fingerprint = request.headers.get("x-fingerprint") as string;
  const forwardedFor = request.headers.get("x-forwarded-for");

  const identifier =
    fingerprint || forwardedFor?.split(",")[0].trim() || "127.0.0.1";

  try {
    const key = `@upstash/usagelimit:${identifier}`;
    const usageData = await redis.get(key);

    const currentUsage = usageData ? parseInt(usageData as string, 10) : 0;
    const isAtLimit = currentUsage >= DAILY_USAGE_LIMIT;

    let ttl: number | null = null;

    if (isAtLimit) {
      ttl = await redis.ttl(key);
    }

    console.log(
      `Usage status check for ${identifier}: ${
        isAtLimit ? "AT LIMIT" : "HAS CREDITS"
      } (usage: ${currentUsage}/${DAILY_USAGE_LIMIT}) TTL: ${ttl}`,
    );

    return { isAtLimit, identifier, ttl };
  } catch (error) {
    console.error("Usage status check error:", error);
    return { isAtLimit: false, identifier, ttl: null };
  }
};

export const incrementUsageCounter = async (
  request: HttpRequest,
): Promise<void> => {
  const fingerprint = request.headers.get("x-fingerprint") as string;
  const forwardedFor = request.headers.get("x-forwarded-for");

  const identifier =
    fingerprint || forwardedFor?.split(",")[0].trim() || "127.0.0.1";

  try {
    const key = `@upstash/usagelimit:${identifier}`;
    const newCount = await redis.incr(key);

    if (newCount === 1) {
      await redis.expire(key, 15 * 60 * 60);
    }

    console.log(
      `Incremented usage counter for ${identifier}: ${newCount}/${DAILY_USAGE_LIMIT}`,
    );
  } catch (error) {
    console.error("Error incrementing usage counter:", error);
  }
};

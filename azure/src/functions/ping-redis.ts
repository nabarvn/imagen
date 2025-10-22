import { redis } from "../lib/redis";
import { app, InvocationContext, Timer } from "@azure/functions";

async function pingRedis(
  _timer: Timer,
  context: InvocationContext,
): Promise<void> {
  context.log("Executing Redis ping cron job...");

  try {
    const timestamp = new Date().toISOString();
    await redis.set("ping:timestamp", timestamp);
    context.log(`✅ Redis ping successful. Timestamp set to: ${timestamp}`);
  } catch (error) {
    context.error("❌ Redis ping failed:", error);

    /*
      Re-throwing the error will mark the function invocation as a failure,
      which can be useful for monitoring and alerts in Azure.
    */
    throw error;
  }
}

app.timer("ping-redis", {
  schedule: "0 0 9 * * *",
  handler: pingRedis,
});

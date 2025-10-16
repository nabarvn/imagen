import * as path from "path";

try {
  const localSettingsPath = path.resolve(__dirname, "../local.settings.json");
  const settings = require(localSettingsPath);

  if (settings.Values) {
    for (const key in settings.Values) {
      process.env[key] = settings.Values[key];
    }
  }
} catch (error) {
  console.error("Could not load local.settings.json.");
}

// import redis client after loading environment variables
import { redis } from "../src/lib/redis";

const RATE_LIMIT_PREFIX = "@upstash/ratelimit";
const USAGE_LIMIT_PREFIX = "@upstash/usagelimit";

const clearKeysForPrefix = async (prefix: string, identifier?: string) => {
  if (identifier) {
    const key = `${prefix}:${identifier}`;
    const deletedCount = await redis.del(key);

    if (deletedCount > 0) {
      console.log(`Deleted key: ${key}`);
    } else {
      console.log(
        `No key found for identifier "${identifier}" with prefix "${prefix}"`,
      );
    }

    return;
  }

  /*
    If no identifier, clear all keys for the prefix
  */
  let cursor = 0;
  let keysToDelete: string[] = [];
  const pattern = `${prefix}:*`;

  console.log(`Scanning for keys with pattern: ${pattern}`);

  do {
    const [newCursor, keys] = await redis.scan(cursor, {
      match: pattern,
      count: 100,
    });

    keysToDelete.push(...keys);
    cursor = newCursor;
  } while (cursor !== 0);

  if (keysToDelete.length > 0) {
    await redis.del(...keysToDelete);
    console.log(`Deleted ${keysToDelete.length} keys with prefix "${prefix}"`);
  } else {
    console.log(`No keys found with prefix "${prefix}" to delete.`);
  }
};

const flushAll = async () => {
  console.log("Flushing the entire Redis database...");

  await redis.flushdb();
  console.log("All keys have been deleted from the Redis database.");
};

const main = async () => {
  const command = process.argv[2];
  const identifier = process.argv[3];

  switch (command) {
    case "usage":
      await clearKeysForPrefix(USAGE_LIMIT_PREFIX, identifier);
      break;

    case "rate":
      await clearKeysForPrefix(RATE_LIMIT_PREFIX, identifier);
      break;

    case "all":
      await flushAll();
      break;

    default:
      console.log("Invalid script. Please use 'usage', 'rate', or 'all'.");

      console.log(
        "Optionally provide an identifier as the next argument to delete a specific key.",
      );

      console.log("\nExamples:");
      console.log("  npm run clear-redis:usage");
      console.log("  npm run clear-redis:rate your-fingerprint-id");
      console.log("  npm run clear-redis:all");
      break;
  }

  process.exit(0);
};

main().catch((err) => {
  console.error("An error occurred:", err);
  process.exit(1);
});

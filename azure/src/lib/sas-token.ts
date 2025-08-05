import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

import { redis } from "./redis";
import { containerClient, sharedKeyCredential } from "./storage";

const SAS_TOKEN_CACHE_KEY = "sasToken";
const SAS_TOKEN_EXPIRY_SECONDS = 29 * 60; // 29 minutes

const generateNewSASToken = async (): Promise<string> => {
  const permissions = new BlobSASPermissions();
  permissions.read = true;
  permissions.write = true;
  permissions.create = true;

  /* 
    Sets the token's operational lifetime to 30 minutes. 
    A corresponding cache utilizes a 29-minute TTL to ensure tokens are proactively refreshed before expiry.
  */
  const expiryDate = new Date();
  expiryDate.setMinutes(expiryDate.getMinutes() + 30);

  return generateBlobSASQueryParameters(
    {
      containerName: containerClient.containerName,
      permissions: permissions,
      expiresOn: expiryDate,
    },
    sharedKeyCredential,
  ).toString();
};

export const getSASToken = async (): Promise<string> => {
  const cachedToken = await redis.get(SAS_TOKEN_CACHE_KEY);

  if (typeof cachedToken === "string") {
    return cachedToken;
  }

  const newSasToken = await generateNewSASToken();

  /* 
    Setting the cache expiry to 29 minutes for a 30-minute token is a deliberate safety measure to prevent race conditions and clock skew issues
  */
  await redis.set(SAS_TOKEN_CACHE_KEY, newSasToken, {
    ex: SAS_TOKEN_EXPIRY_SECONDS,
  });

  return newSasToken;
};

import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;

if (!accountName || !accountKey) {
  throw new Error(
    "Azure Storage account name and key must be provided in environment variables.",
  );
}

export const containerName = "images";

export const sharedKeyCredential = new StorageSharedKeyCredential(
  accountName,
  accountKey,
);

export const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential,
);

export const containerClient =
  blobServiceClient.getContainerClient(containerName);

containerClient.createIfNotExists();

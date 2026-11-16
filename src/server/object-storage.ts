import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET?.trim();
let client: S3Client | undefined;

export const isObjectStorageConfigured = Boolean(bucket);

export function getObjectStorage() {
  if (!bucket) return null;

  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const pathStyle = process.env.S3_FORCE_PATH_STYLE;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  client ??= new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint,
    forcePathStyle: pathStyle === undefined ? Boolean(endpoint) : pathStyle === "true",
    credentials: accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return { bucket, client };
}

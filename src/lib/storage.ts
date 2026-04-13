/**
 * Cloudflare R2 storage helper (S3-compatible).
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL  (optional — public bucket URL for direct links)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 não configurado. Defina CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY no .env"
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function uploadFile(
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<{ key: string; url: string }> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME não definido");

  const client = getClient();

  // Timestamp prefix to avoid collisions
  const key = `contratos/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(fileBuffer),
      ContentType: mimeType,
    })
  );

  // If bucket has a public URL configured, use it directly
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase) {
    return { key, url: `${publicBase}/${key}` };
  }

  // Otherwise generate a presigned URL valid for 7 days
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 * 60 * 24 * 7 }
  );

  return { key, url };
}

export async function deleteFile(key: string): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) return;
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

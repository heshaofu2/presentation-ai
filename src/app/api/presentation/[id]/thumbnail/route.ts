import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { getObjectStorage } from "@/server/object-storage";
import {
  canEditDocument,
  canReadDocument,
  getSessionIdentity,
} from "@/server/share/authorization";

const pngType = "image/png";
const maxBytes = 4 * 1024 * 1024;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const headers = { "Cache-Control": "private, no-store" };
type RouteContext = { params: Promise<{ id: string }> };

function thumbnailKey(id: string) {
  return `thumbnails/${id}.png`;
}

export async function POST(request: Request, { params }: RouteContext) {
  const storage = getObjectStorage();
  if (!storage) return new Response(null, { status: 503 });

  const { id } = await params;
  const identity = await getSessionIdentity();
  if (!identity.userId) return new Response(null, { status: 401 });
  if (!(await canEditDocument(id, identity))) {
    return new Response(null, { status: 404 });
  }

  if (request.headers.get("content-type") !== pngType) {
    return new Response(null, { status: 415 });
  }
  if (Number(request.headers.get("content-length")) > maxBytes) {
    return new Response(null, { status: 413 });
  }

  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks, size);
  if (!body.subarray(0, pngSignature.length).equals(pngSignature)) {
    return new Response(null, { status: 415 });
  }

  try {
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: thumbnailKey(id),
      Body: body,
      ContentType: pngType,
    }));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to store presentation thumbnail", error);
    return new Response(null, { status: 502 });
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const storage = getObjectStorage();
  const { id } = await params;
  if (!storage || !(await canReadDocument(id, await getSessionIdentity()))) {
    return new Response(null, { status: 404, headers });
  }

  try {
    const result = await storage.client.send(new GetObjectCommand({
      Bucket: storage.bucket,
      Key: thumbnailKey(id),
    }));
    if (!result.Body) return new Response(null, { status: 404, headers });

    return new Response(result.Body.transformToWebStream(), {
      headers: { ...headers, "Content-Type": pngType, "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return new Response(null, { status: 404, headers });
    }
    console.error("Failed to read presentation thumbnail", error);
    return new Response(null, { status: 502, headers });
  }
}

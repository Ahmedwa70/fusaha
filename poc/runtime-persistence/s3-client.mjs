// Minimal S3 REST client with AWS Signature Version 4 for the Runtime
// Persistence integration POC. Uses only node:crypto — no npm dependencies.
// Talks to the SeaweedFS S3 gateway of the disposable POC environment only.

import { createHash, createHmac } from "node:crypto";

export class S3Error extends Error {
  constructor(code, status, message) {
    super(message ?? code);
    this.name = "S3Error";
    this.code = code;
    this.status = status;
  }
}

const hashHex = (data) => createHash("sha256").update(data).digest("hex");

export function createS3Client({ endpoint, accessKey, secretKey, region = "us-east-1", fetchImpl = fetch }) {
  const base = new URL(endpoint);
  const service = "aws4_request";

  function signingKey(dateStamp) {
    const kDate = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(region).digest();
    const kService = createHmac("sha256", kRegion).update("s3").digest();
    return createHmac("sha256", kService).update(service).digest();
  }

  async function request(method, bucket, key, { query = {}, headers = {}, body } = {}) {
    const payload = body ?? Buffer.alloc(0);
    const payloadHash = hashHex(payload);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const dateStamp = amzDate.slice(0, 8);

    const allHeaders = {
      host: base.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...headers,
    };
    const lower = Object.fromEntries(Object.entries(allHeaders).map(([name, value]) => [name.toLowerCase(), String(value).trim()]));
    const signedNames = Object.keys(lower).sort();
    const canonicalHeaders = signedNames.map((name) => `${name}:${lower[name]}\n`).join("");
    const signedHeaders = signedNames.join(";");

    const canonicalUri = `/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(query[name])}`)
      .join("&");

    const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${region}/s3/${service}`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hashHex(canonicalRequest)].join("\n");
    const signature = createHmac("sha256", signingKey(dateStamp)).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `${base.protocol}//${base.host}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
    return fetchImpl(url, {
      method,
      headers: { ...lower, authorization },
      body: method === "PUT" ? payload : undefined,
    });
  }

  function translateError(response, text) {
    const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? `HTTP_${response.status}`;
    return new S3Error(code, response.status, `S3 ${code} (${response.status}): ${text.slice(0, 300)}`);
  }

  return {
    async putObject(bucket, key, body, { contentType, ifNoneMatch } = {}) {
      const headers = {};
      if (contentType) headers["content-type"] = contentType;
      if (ifNoneMatch) headers["if-none-match"] = ifNoneMatch;
      const response = await request("PUT", bucket, key, { headers, body: Buffer.isBuffer(body) ? body : Buffer.from(body) });
      const text = await response.text();
      if (!response.ok) throw translateError(response, text);
      return { etag: response.headers.get("etag"), versionId: response.headers.get("x-amz-version-id") };
    },

    async getObject(bucket, key, { versionId } = {}) {
      const response = await request("GET", bucket, key, { query: versionId ? { versionId } : {} });
      if (response.status === 404) throw new S3Error("NoSuchKey", 404, `object not found: ${key}`);
      if (!response.ok) throw translateError(response, await response.text());
      return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type"),
        etag: response.headers.get("etag"),
        versionId: response.headers.get("x-amz-version-id"),
      };
    },

    async headObject(bucket, key) {
      const response = await request("HEAD", bucket, key, {});
      if (response.status === 404) return null;
      if (!response.ok) throw new S3Error(`HTTP_${response.status}`, response.status, `S3 HEAD failed for ${key}`);
      return {
        sizeBytes: Number(response.headers.get("content-length")),
        etag: response.headers.get("etag"),
        versionId: response.headers.get("x-amz-version-id"),
      };
    },
  };
}

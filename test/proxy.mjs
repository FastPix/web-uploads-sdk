// Tiny FastPix sign proxy for local development.
//
//   node test/proxy.mjs
//
// Listens on http://localhost:3000 and forwards POST /sign to the FastPix
// API. The browser test page calls this proxy instead of api.fastpix.com
// directly, sidestepping FastPix's per-workspace CORS allowlist. Requires
// Node 18+ (uses the built-in fetch).
//
// Request shape:
//   POST /sign
//   { token, secret, host, requestBody }
// Response: whatever FastPix returns (status + body passed through).

import http from "node:http";

const PORT = Number(process.env.PORT) || 3000;

function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end--;
  }
  return value.slice(0, end);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url !== "/sign" || req.method !== "POST") {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  let raw = "";
  for await (const chunk of req) raw += chunk;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { token, secret, host, requestBody } = payload;
  if (!token || !secret || !host || !requestBody) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Missing one of: token, secret, host, requestBody",
      }),
    );
    return;
  }

  const auth = Buffer.from(`${token}:${secret}`).toString("base64");
  const upstreamUrl = `${trimTrailingSlashes(host)}/v1/on-demand/upload`;

  console.log(`POST ${upstreamUrl}`);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(requestBody),
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") ?? "application/json",
    );
    res.end(text);
    console.log(`  → ${upstream.status} ${upstream.statusText}`);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Upstream fetch failed",
        detail: err?.message ?? String(err),
      }),
    );
    console.error("upstream error:", err);
  }
});

server.listen(PORT, () => {
  console.log(`FastPix sign proxy → http://localhost:${PORT}/sign`);
});

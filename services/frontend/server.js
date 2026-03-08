/**
 * Serves static frontend build and /config/contracts.json from CONTRACTS_JSON_PATH.
 * Used in Docker when deploy-output is mounted.
 */
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const CONTRACTS_JSON_PATH = process.env.CONTRACTS_JSON_PATH ?? "/deploy-output/contracts.json";
const DIST_DIR = join(__dirname, "dist");

function serveStatic(pathname) {
  if (pathname === "/" || pathname === "") return join(DIST_DIR, "index.html");
  if (pathname === "/config/contracts.json") return null;
  const file = join(DIST_DIR, pathname.slice(1));
  return file.startsWith(DIST_DIR) ? file : null;
}

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;

  if (pathname === "/config/env.json") {
    const env = {
      VITE_RPC_URL: process.env.RPC_URL ?? "http://127.0.0.1:8545",
      VITE_BUNDLER_URL: process.env.BUNDLER_URL ?? "",
      VITE_PAYMASTER_API_URL: process.env.PAYMASTER_API_URL ?? "",
      VITE_CHAIN_ID: process.env.CHAIN_ID ?? "137",
      VITE_ENTRYPOINT_ADDRESS: process.env.ENTRYPOINT_ADDRESS ?? "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      VITE_USDC_ADDRESS: process.env.USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      VITE_ANVIL_WHALE_CANDIDATES: process.env.ANVIL_WHALE_CANDIDATES ?? "0x47c031236e19d024b42f8de678d3110562d925b5,0x794a61358D6845594F94dc1DB02A252b5b4814aD,0xF977814e90dA44bFA03b6295A0616a897441aceC,0x28C6c06298d514Db089934071355E5743bf21d60",
      VITE_ENABLE_ANVIL_WHALE_FUNDING: process.env.ENABLE_ANVIL_WHALE_FUNDING ?? "true",
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(env));
    return;
  }

  if (pathname === "/config/contracts.json") {
    try {
      const data = existsSync(CONTRACTS_JSON_PATH)
        ? readFileSync(CONTRACTS_JSON_PATH, "utf8")
        : JSON.stringify({ error: "Contracts not deployed" });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  let file = serveStatic(pathname);
  if (!file && !pathname.startsWith("/config/")) {
    file = join(DIST_DIR, "index.html");
  }
  if (file && existsSync(file)) {
    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    const types = {
      html: "text/html",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
      ico: "image/x-icon",
      svg: "image/svg+xml",
      woff: "font/woff",
      woff2: "font/woff2",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    res.writeHead(200, { "Content-Type": types[ext] ?? "application/octet-stream" });
    res.end(readFileSync(file));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend server listening on port ${PORT}`);
});

// Container entry point for the Next.js standalone server.
//
// In production the Caddy -> frontend hop is encrypted too (ASVS V12.3.1). Next's standalone
// server only speaks plain HTTP, so when TLS_CERT_FILE and TLS_KEY_FILE are set this script
// starts Next on the container's loopback interface (not reachable from other containers) and
// serves HTTPS on PORT, passing every request through unchanged. Without those settings it
// simply runs Next as before.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const certFile = process.env.TLS_CERT_FILE?.trim();
const keyFile = process.env.TLS_KEY_FILE?.trim();

if (!certFile || !keyFile) {
  await import("./server.js");
} else {
  const publicPort = Number(process.env.PORT || 3000);
  const innerPort = publicPort + 1;

  const next = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(innerPort), HOSTNAME: "127.0.0.1" },
    stdio: "inherit",
  });
  next.on("exit", (code) => process.exit(code ?? 1));
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => next.kill(signal));
  }

  https
    .createServer(
      { cert: readFileSync(certFile), key: readFileSync(keyFile), minVersion: "TLSv1.2" },
      (req, res) => {
        const upstream = http.request(
          {
            host: "127.0.0.1",
            port: innerPort,
            method: req.method,
            path: req.url,
            headers: req.headers,
          },
          (inner) => {
            res.writeHead(inner.statusCode ?? 502, inner.rawHeaders);
            inner.pipe(res);
          },
        );
        upstream.on("error", () => {
          if (!res.headersSent) res.writeHead(502);
          res.end();
        });
        req.pipe(upstream);
      },
    )
    .listen(publicPort, "0.0.0.0", () => {
      console.log(
        JSON.stringify({ level: "info", time: new Date().toISOString(), service: "frontend", msg: `TLS on :${publicPort} -> Next on 127.0.0.1:${innerPort}` }),
      );
    });
}

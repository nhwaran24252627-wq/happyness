const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const path = require("path");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const ASSETS = path.join(ROOT, "assets");
const ASSETS2 = path.join(ROOT, "assets2");

const PORT = Number(process.env.PORT || 3000);

const imageExtensions = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".heif"
]);

const videoExtensions = new Set([
  ".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"
]);

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4v": "video/x-m4v",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".ogg": "video/ogg",
  ".ogv": "video/ogg",
  ".png": "image/png",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

function mediaType(fileName) {
  const ext = path.extname(fileName).toLowerCase();

  if (imageExtensions.has(ext)) return "image";
  if (videoExtensions.has(ext)) return "video";

  return null;
}

function happinessNumber(fileName) {
  const stem = path.basename(
    fileName,
    path.extname(fileName)
  );

  const match = stem.match(
    /^happ(?:i|y)ness[-_ ]0*(\d+)$/i
  );

  if (!match) return null;

  const number = Number(match[1]);

  return number >= 1 && number <= 15
    ? number
    : null;
}

function sortMedia(a, b) {
  const aNumber = happinessNumber(a.name);
  const bNumber = happinessNumber(b.name);

  if (aNumber !== null && bNumber !== null) {
    return (
      aNumber - bNumber ||
      nameCollator.compare(a.name, b.name)
    );
  }

  if (aNumber !== null) return -1;
  if (bNumber !== null) return 1;

  return nameCollator.compare(a.name, b.name);
}


// ------------------------------------------------------------
// LOCAL ASSETS2 VIDEOS
// ------------------------------------------------------------

async function getLocalVideos() {
  await fsp.mkdir(ASSETS2, { recursive: true });

  const entries = await fsp.readdir(
    ASSETS2,
    { withFileTypes: true }
  );

  return entries
    .filter(entry => entry.isFile())
    .map(entry => ({
      name: entry.name,
      type: mediaType(entry.name)
    }))
    .filter(item => item.type === "video")
    .sort(sortMedia)
    .map(item => ({
      name: item.name,
      type: "video",
      src:
        "/assets2/" +
        encodeURIComponent(item.name)
    }));
}


// ------------------------------------------------------------
// JSON
// ------------------------------------------------------------

function sendJson(response, status, data) {
  const body = JSON.stringify(data);

  response.writeHead(status, {
    "Content-Type":
      "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length":
      Buffer.byteLength(body)
  });

  response.end(body);
}


// ------------------------------------------------------------
// TEXT
// ------------------------------------------------------------

function sendText(response, status, message) {
  response.writeHead(status, {
    "Content-Type":
      "text/plain; charset=utf-8"
  });

  response.end(message);
}


// ------------------------------------------------------------
// SAFE FILE NAME
// ------------------------------------------------------------

function isSafeFileName(name) {
  return Boolean(name) &&
    !name.includes("/") &&
    !name.includes("\\") &&
    name !== "." &&
    name !== "..";
}


// ------------------------------------------------------------
// SEND FILE
// Supports video range requests
// ------------------------------------------------------------

async function sendFile(
  request,
  response,
  filePath,
  cacheControl = "public, max-age=3600"
) {
  let stats;

  try {
    stats = await fsp.stat(filePath);
  } catch {
    sendText(response, 404, "File not found");
    return;
  }

  if (!stats.isFile()) {
    sendText(response, 404, "File not found");
    return;
  }

  const extension =
    path.extname(filePath).toLowerCase();

  const contentType =
    mimeTypes[extension] ||
    "application/octet-stream";

  const range = request.headers.range;

  const headers = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl
  };

  // ----------------------------------------------------------
  // VIDEO RANGE REQUEST
  // ----------------------------------------------------------

  if (range) {
    const match =
      range.match(/^bytes=(\d*)-(\d*)$/);

    if (!match) {
      response.writeHead(416, {
        "Content-Range":
          `bytes */${stats.size}`
      });

      response.end();
      return;
    }

    let start =
      match[1] === ""
        ? 0
        : Number(match[1]);

    let end =
      match[2] === ""
        ? stats.size - 1
        : Number(match[2]);

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start > end ||
      start >= stats.size
    ) {
      response.writeHead(416, {
        "Content-Range":
          `bytes */${stats.size}`
      });

      response.end();
      return;
    }

    end =
      Math.min(
        end,
        stats.size - 1
      );

    response.writeHead(206, {
      ...headers,

      "Content-Length":
        end - start + 1,

      "Content-Range":
        `bytes ${start}-${end}/${stats.size}`
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    fs.createReadStream(
      filePath,
      {
        start,
        end
      }
    ).pipe(response);

    return;
  }

  // ----------------------------------------------------------
  // NORMAL FILE
  // ----------------------------------------------------------

  response.writeHead(200, {
    ...headers,
    "Content-Length": stats.size
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  fs.createReadStream(filePath)
    .pipe(response);
}


// ------------------------------------------------------------
// SERVER
// ------------------------------------------------------------

const server = http.createServer(
  async (request, response) => {

    if (
      !["GET", "HEAD"]
        .includes(request.method)
    ) {
      response.writeHead(405, {
        Allow: "GET, HEAD"
      });

      response.end();
      return;
    }

    const url = new URL(
      request.url,
      "http://localhost"
    );

    try {

      // ------------------------------------------------------
      // HEALTH CHECK
      // ------------------------------------------------------

      if (
        url.pathname === "/api/health"
      ) {
        sendJson(response, 200, {
          ok: true
        });

        return;
      }


      // ------------------------------------------------------
      // LOCAL VIDEOS API
      // ------------------------------------------------------

      if (
        url.pathname === "/api/videos"
      ) {
        sendJson(
          response,
          200,
          await getLocalVideos()
        );

        return;
      }


      // ------------------------------------------------------
      // ASSETS2 VIDEO FILES
      // ------------------------------------------------------

      if (
        url.pathname.startsWith(
          "/assets2/"
        )
      ) {

        const name =
          decodeURIComponent(
            url.pathname.slice(
              "/assets2/".length
            )
          );

        if (!isSafeFileName(name)) {
          sendText(
            response,
            400,
            "Invalid video path"
          );

          return;
        }

        await sendFile(
          request,
          response,
          path.join(
            ASSETS2,
            name
          )
        );

        return;
      }


      // ------------------------------------------------------
      // OLD ASSETS FOLDER
      // ------------------------------------------------------

      if (
        url.pathname.startsWith(
          "/assets/"
        )
      ) {

        const name =
          decodeURIComponent(
            url.pathname.slice(
              "/assets/".length
            )
          );

        if (!isSafeFileName(name)) {
          sendText(
            response,
            400,
            "Invalid asset path"
          );

          return;
        }

        await sendFile(
          request,
          response,
          path.join(
            ASSETS,
            name
          )
        );

        return;
      }


      // ------------------------------------------------------
      // PUBLIC FOLDER
      // ------------------------------------------------------

      let relativePath =
        url.pathname === "/"
          ? "index.html"
          : decodeURIComponent(
              url.pathname.replace(
                /^\//,
                ""
              )
            );

      const resolvedPath =
        path.resolve(
          PUBLIC,
          relativePath
        );

      const relative =
        path.relative(
          PUBLIC,
          resolvedPath
        );

      if (
        relative.startsWith("..") ||
        path.isAbsolute(relative)
      ) {
        sendText(
          response,
          400,
          "Invalid path"
        );

        return;
      }

      await sendFile(
        request,
        response,
        resolvedPath,
        "no-store"
      );

    } catch (error) {

      console.error(
        "Server error:",
        error
      );

      if (!response.headersSent) {
        sendJson(
          response,
          500,
          {
            error:
              "Server error"
          }
        );
      }
    }
  }
);


// ------------------------------------------------------------
// START
// ------------------------------------------------------------

server.on(
  "error",
  error => {

    if (
      error.code === "EADDRINUSE"
    ) {
      console.error(
        `Port ${PORT} is already in use.`
      );

      console.error(
        "Try: set PORT=3001 && npm start"
      );
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  }
);


server.listen(
  PORT,
  () => {

    console.log(
      `Memory gallery running at http://localhost:${PORT}`
    );

    console.log(
      "Videos folder:",
      ASSETS2
    );

  }
);
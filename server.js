const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const path = require("path");

const ROOT = __dirname;

const PUBLIC = path.join(ROOT, "public");
const ASSETS = path.join(ROOT, "assets");
const ASSETS2 = path.join(ROOT, "assets2");

const PORT = 3000;


// ============================================================
// FILE TYPES
// ============================================================

const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".heic",
  ".heif"
]);

const videoExtensions = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".ogv",
  ".ogg"
]);


// ============================================================
// MIME TYPES
// ============================================================

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",

  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",

  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".ogv": "video/ogg",
  ".ogg": "video/ogg",

  ".json": "application/json; charset=utf-8"
};


// ============================================================
// HELPERS
// ============================================================

function getMediaType(filename) {

  const ext =
    path.extname(filename).toLowerCase();

  if (imageExtensions.has(ext)) {
    return "image";
  }

  if (videoExtensions.has(ext)) {
    return "video";
  }

  return null;
}


function happinessNumber(filename) {

  const stem =
    path.basename(
      filename,
      path.extname(filename)
    );

  const match =
    stem.match(
      /^happiness[_ -]?0*(\d+)$/i
    );

  if (!match) {
    return Infinity;
  }

  const number =
    Number(match[1]);

  if (
    number >= 1 &&
    number <= 15
  ) {
    return number;
  }

  return Infinity;
}


function sortMedia(a, b) {

  const aNumber =
    happinessNumber(a.name);

  const bNumber =
    happinessNumber(b.name);

  if (
    aNumber !== Infinity ||
    bNumber !== Infinity
  ) {

    if (
      aNumber !== bNumber
    ) {
      return aNumber - bNumber;
    }
  }

  return a.name.localeCompare(
    b.name,
    undefined,
    {
      numeric: true,
      sensitivity: "base"
    }
  );
}


function safeFileName(name) {

  return Boolean(name) &&
    !name.includes("/") &&
    !name.includes("\\") &&
    name !== "." &&
    name !== "..";
}


// ============================================================
// GET VIDEOS FROM assets2
// ============================================================

async function getVideos() {

  await fsp.mkdir(
    ASSETS2,
    {
      recursive: true
    }
  );

  const files =
    await fsp.readdir(
      ASSETS2,
      {
        withFileTypes: true
      }
    );

  return files

    .filter(
      file =>
        file.isFile()
    )

    .filter(
      file =>
        getMediaType(file.name) ===
        "video"
    )

    .map(
      file => ({
        name: file.name,
        type: "video",
        src:
          "/assets2/" +
          encodeURIComponent(
            file.name
          )
      })
    )

    .sort(sortMedia);
}


// ============================================================
// SEND JSON
// ============================================================

function sendJson(
  response,
  status,
  data
) {

  const body =
    JSON.stringify(data);

  response.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Cache-Control":
        "no-store",

      "Content-Length":
        Buffer.byteLength(body)
    }
  );

  response.end(body);
}


// ============================================================
// SEND TEXT
// ============================================================

function sendText(
  response,
  status,
  text
) {

  response.writeHead(
    status,
    {
      "Content-Type":
        "text/plain; charset=utf-8"
    }
  );

  response.end(text);
}


// ============================================================
// SEND FILE
// Supports video streaming / range requests
// ============================================================

async function sendFile(
  request,
  response,
  filePath
) {

  let stats;

  try {

    stats =
      await fsp.stat(
        filePath
      );

  } catch {

    sendText(
      response,
      404,
      "File not found"
    );

    return;
  }


  if (!stats.isFile()) {

    sendText(
      response,
      404,
      "File not found"
    );

    return;
  }


  const ext =
    path.extname(
      filePath
    ).toLowerCase();


  const contentType =
    mimeTypes[ext] ||
    "application/octet-stream";


  const range =
    request.headers.range;


  const commonHeaders = {

    "Content-Type":
      contentType,

    "Accept-Ranges":
      "bytes",

    "Cache-Control":
      "public, max-age=3600"
  };


  // ==========================================================
  // VIDEO RANGE REQUEST
  // ==========================================================

  if (range) {

    const match =
      range.match(
        /^bytes=(\d*)-(\d*)$/
      );


    if (!match) {

      response.writeHead(
        416,
        {
          "Content-Range":
            `bytes */${stats.size}`
        }
      );

      response.end();

      return;
    }


    let start =
      match[1]
        ? Number(match[1])
        : 0;


    let end =
      match[2]
        ? Number(match[2])
        : stats.size - 1;


    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start > end ||
      start >= stats.size
    ) {

      response.writeHead(
        416,
        {
          "Content-Range":
            `bytes */${stats.size}`
        }
      );

      response.end();

      return;
    }


    end =
      Math.min(
        end,
        stats.size - 1
      );


    response.writeHead(
      206,
      {
        ...commonHeaders,

        "Content-Length":
          end - start + 1,

        "Content-Range":
          `bytes ${start}-${end}/${stats.size}`
      }
    );


    if (
      request.method ===
      "HEAD"
    ) {

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


  // ==========================================================
  // NORMAL FILE
  // ==========================================================

  response.writeHead(
    200,
    {
      ...commonHeaders,

      "Content-Length":
        stats.size
    }
  );


  if (
    request.method ===
    "HEAD"
  ) {

    response.end();

    return;
  }


  fs.createReadStream(
    filePath
  ).pipe(response);
}


// ============================================================
// SERVER
// ============================================================

const server =
  http.createServer(
    async (
      request,
      response
    ) => {

      if (
        request.method !== "GET" &&
        request.method !== "HEAD"
      ) {

        response.writeHead(
          405,
          {
            Allow: "GET, HEAD"
          }
        );

        response.end();

        return;
      }


      const url =
        new URL(
          request.url,
          "http://localhost"
        );


      try {

        // ----------------------------------------------------
        // HEALTH TEST
        // ----------------------------------------------------

        if (
          url.pathname ===
          "/api/health"
        ) {

          sendJson(
            response,
            200,
            {
              ok: true
            }
          );

          return;
        }


        // ----------------------------------------------------
        // GET VIDEOS
        // ----------------------------------------------------

        if (
          url.pathname ===
          "/api/videos"
        ) {

          const videos =
            await getVideos();

          sendJson(
            response,
            200,
            videos
          );

          return;
        }


        // ----------------------------------------------------
        // GET VIDEO FILE
        // ----------------------------------------------------

        if (
          url.pathname.startsWith(
            "/assets2/"
          )
        ) {

          const filename =
            decodeURIComponent(
              url.pathname.slice(
                "/assets2/".length
              )
            );


          if (
            !safeFileName(filename)
          ) {

            sendText(
              response,
              400,
              "Invalid video filename"
            );

            return;
          }


          await sendFile(
            request,
            response,
            path.join(
              ASSETS2,
              filename
            )
          );

          return;
        }


        // ----------------------------------------------------
        // OLD ASSETS FILE
        // ----------------------------------------------------

        if (
          url.pathname.startsWith(
            "/assets/"
          )
        ) {

          const filename =
            decodeURIComponent(
              url.pathname.slice(
                "/assets/".length
              )
            );


          if (
            !safeFileName(filename)
          ) {

            sendText(
              response,
              400,
              "Invalid asset filename"
            );

            return;
          }


          await sendFile(
            request,
            response,
            path.join(
              ASSETS,
              filename
            )
          );

          return;
        }


        // ----------------------------------------------------
        // PUBLIC FOLDER
        // ----------------------------------------------------

        let requestedFile;


        if (
          url.pathname === "/"
        ) {

          requestedFile =
            "index.html";

        } else {

          requestedFile =
            decodeURIComponent(
              url.pathname.replace(
                /^\//,
                ""
              )
            );
        }


        const filePath =
          path.resolve(
            PUBLIC,
            requestedFile
          );


        const relative =
          path.relative(
            PUBLIC,
            filePath
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
          filePath
        );


      } catch (error) {

        console.error(
          error
        );


        if (
          !response.headersSent
        ) {

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


// ============================================================
// START
// ============================================================

server.listen(
  PORT,
  () => {

    console.log("");
    console.log(
      "================================"
    );

    console.log(
      " MEMORY GALLERY"
    );

    console.log(
      "================================"
    );

    console.log(
      `http://localhost:${PORT}`
    );

    console.log(
      "Videos:",
      ASSETS2
    );

    console.log(
      "================================"
    );

  }
);

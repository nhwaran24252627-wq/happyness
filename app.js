const gallery = document.getElementById("gallery");
const memoryCount = document.getElementById("memoryCount");
const muteAll = document.getElementById("muteAll");
const emptyTemplate = document.getElementById("emptyTemplate");
const errorTemplate = document.getElementById("errorTemplate");

const REQUEST_TIMEOUT_MS = 10000;


// ============================================================
// GOOGLE DRIVE PHOTO API
// ============================================================

const GOOGLE_DRIVE_API =
  "https://script.google.com/macros/s/AKfycbzau-6zZkb0X3KM5gqgXKRfHVJi7s4OG2SfkKMSqGYD6L7845LE1KEf9AyYGCpwJDoM/exec";


// ============================================================
// VIDEO SETTINGS
// ============================================================

const VIDEO_FOLDER = "assets2";


// ============================================================
// STATE
// ============================================================

// IMPORTANT:
// Sound is ON by default.
let muted = false;

let videos = [];

let videoObserver = null;


// ============================================================
// DETECT GITHUB PAGES
// ============================================================

function getGitHubRepository() {

  const host =
    window.location.hostname;

  const path =
    window.location.pathname;


  if (!host.endsWith(".github.io")) {

    return null;

  }


  const owner =
    host.split(".")[0];

  const parts =
    path
      .split("/")
      .filter(Boolean);


  // Project Pages
  // username.github.io/repository/
  if (parts.length > 0) {

    return {
      owner: owner,
      repo: parts[0]
    };

  }


  // User Pages
  // username.github.io
  return {
    owner: owner,
    repo: owner + ".github.io"
  };

}


// ============================================================
// HELPERS
// ============================================================

function setBusy(isBusy) {

  gallery.setAttribute(
    "aria-busy",
    String(isBusy)
  );

}


function setLoadingState() {

  gallery.replaceChildren();


  const state =
    document.createElement("section");

  state.className =
    "state-card loading-state";


  state.innerHTML =
    '<div class="loading-orbit" aria-hidden="true">✦</div>' +
    '<p class="state-kicker">Just a moment</p>' +
    "<h2>Loading memories…</h2>" +
    "<p>Reading the memories.</p>";


  gallery.appendChild(state);


  memoryCount.textContent =
    "Preparing memories";

}


function showEmptyState() {

  gallery.replaceChildren(
    emptyTemplate.content.cloneNode(true)
  );


  memoryCount.textContent =
    "No memories yet";

}


function showError(message) {

  const errorState =
    errorTemplate.content.cloneNode(true);


  const detail =
    errorState.querySelector(
      ".error-detail"
    );


  if (detail) {

    detail.textContent =
      message;

  }


  const retryButton =
    errorState.querySelector(
      ".retry-button"
    );


  if (retryButton) {

    retryButton.addEventListener(
      "click",
      loadMedia
    );

  }


  gallery.replaceChildren(
    errorState
  );


  memoryCount.textContent =
    "Unable to load";

}


function createMediaFallback(
  frame,
  message
) {

  const fallback =
    document.createElement("p");


  fallback.className =
    "media-fallback";


  fallback.textContent =
    message;


  frame.appendChild(
    fallback
  );

}


function formatCount(count) {

  return (
    count +
    (
      count === 1
        ? " memory"
        : " memories"
    )
  );

}


// ============================================================
// SORTING
// happiness_1 → happiness_15 FIRST
// everything else AFTER
// ============================================================

function getHappinessNumber(name) {

  const match =
    name.match(
      /^happiness_(\d+)/i
    );


  return match
    ? Number(match[1])
    : Infinity;

}


function sortMedia(a, b) {

  const aNumber =
    getHappinessNumber(a.name);

  const bNumber =
    getHappinessNumber(b.name);


  if (
    aNumber !== Infinity ||
    bNumber !== Infinity
  ) {

    if (
      aNumber !== bNumber
    ) {

      return (
        aNumber -
        bNumber
      );

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


// ============================================================
// PAUSE ALL OTHER VIDEOS
// ============================================================

function pauseOtherVideos(currentVideo) {

  videos.forEach(
    (video) => {

      if (
        video !== currentVideo &&
        !video.paused
      ) {

        video.pause();

      }

    }
  );

}


// ============================================================
// CREATE MEDIA FRAME
// ============================================================

function addMediaFrame(
  item,
  index
) {

  const section =
    document.createElement("section");


  section.className =
    "memory";


  section.style.setProperty(
    "--memory-index",
    index + 1
  );


  const frame =
    document.createElement("figure");


  frame.className =
    "frame";


  const media =
    document.createElement(
      item.type === "video"
        ? "video"
        : "img"
    );


  media.src =
    item.src;


  // ==========================================================
  // VIDEO
  // ==========================================================

  if (
    item.type === "video"
  ) {

    // Native browser controls.
    // This gives the user:
    // ▶ Play
    // ⏸ Pause
    // 🔊 Volume
    // Fullscreen
    media.controls = true;


    // Sound ON by default.
    media.muted = false;


    media.defaultMuted = false;


    media.playsInline =
      true;


    // Do NOT autoplay.
    media.autoplay =
      false;


    // Prevent endless background loading.
    media.preload =
      "metadata";


    media.loop =
      true;


    media.setAttribute(
      "aria-label",
      "Video"
    );


    // --------------------------------------------------------
    // WHEN THIS VIDEO STARTS PLAYING
    // PAUSE EVERY OTHER VIDEO
    // --------------------------------------------------------

    media.addEventListener(
      "play",
      () => {

        // Always keep sound enabled.
        media.muted =
          false;


        media.defaultMuted =
          false;


        pauseOtherVideos(
          media
        );

      }
    );


    // --------------------------------------------------------
    // USER PRESSES PLAY
    // MAKE SURE SOUND IS ON
    // --------------------------------------------------------

    media.addEventListener(
      "playing",
      () => {

        media.muted =
          false;

      }
    );


    // --------------------------------------------------------
    // VIDEO METADATA
    // --------------------------------------------------------

    media.addEventListener(
      "loadedmetadata",
      () => {

        if (
          media.videoWidth &&
          media.videoHeight
        ) {

          frame.style.aspectRatio =
            media.videoWidth +
            " / " +
            media.videoHeight;


          frame.classList.add(
            "has-media"
          );

        }

      }
    );


    // --------------------------------------------------------
    // VIDEO ERROR
    // --------------------------------------------------------

    media.addEventListener(
      "error",
      () => {

        createMediaFallback(
          frame,
          "This video could not be previewed in this browser."
        );

      },
      {
        once: true
      }
    );


    videos.push(
      media
    );


    // Small video indicator.
    const badge =
      document.createElement(
        "span"
      );


    badge.className =
      "video-badge";


    badge.textContent =
      "Video";


    frame.appendChild(
      badge
    );

  }


  // ==========================================================
  // IMAGE
  // ==========================================================

  else {

    media.alt =
      item.name;


    media.loading =
      index < 2
        ? "eager"
        : "lazy";


    media.decoding =
      "async";


    media.addEventListener(
      "load",
      () => {

        if (
          media.naturalWidth &&
          media.naturalHeight
        ) {

          frame.style.aspectRatio =
            media.naturalWidth +
            " / " +
            media.naturalHeight;


          frame.classList.add(
            "has-media"
          );

        }

      }
    );


    media.addEventListener(
      "error",
      () => {

        createMediaFallback(
          frame,
          "This image could not be previewed."
        );

      },
      {
        once: true
      }
    );

  }


  frame.appendChild(
    media
  );


  // ==========================================================
  // CAPTION
  // ==========================================================

  const caption =
    document.createElement(
      "figcaption"
    );


  caption.className =
    "media-label";


  caption.title =
    item.name;


  const fileName =
    document.createElement(
      "span"
    );


  fileName.textContent =
    item.name;


  caption.appendChild(
    fileName
  );


  const number =
    document.createElement(
      "span"
    );


  number.className =
    "memory-number";


  number.textContent =
    String(
      index + 1
    ).padStart(
      2,
      "0"
    );


  caption.appendChild(
    number
  );


  frame.appendChild(
    caption
  );


  section.appendChild(
    frame
  );


  return section;

}


// ============================================================
// VIDEO SCROLL BEHAVIOUR
// ============================================================

function setupVideoObserver() {

  if (
    videoObserver
  ) {

    videoObserver.disconnect();

  }


  if (
    !videos.length
  ) {

    return;

  }


  videoObserver =
    new IntersectionObserver(

      (entries) => {

        entries.forEach(
          (entry) => {

            const video =
              entry.target;


            // ------------------------------------------------
            // IMPORTANT:
            // We DO NOT autoplay videos anymore.
            //
            // We only pause videos when they leave view.
            // This prevents multiple videos from playing.
            // ------------------------------------------------

            if (
              !entry.isIntersecting ||
              entry.intersectionRatio < 0.25
            ) {

              if (
                !video.paused
              ) {

                video.pause();

              }

            }

          }
        );

      },

      {
        threshold: [
          0,
          0.25,
          0.65,
          1
        ]
      }

    );


  videos.forEach(
    (video) => {

      videoObserver.observe(
        video
      );

    }
  );

}


// ============================================================
// LOAD GOOGLE DRIVE PHOTOS
// ============================================================

async function fetchDrivePhotos() {

  const controller =
    new AbortController();


  const timeout =
    window.setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS
    );


  try {

    const response =
      await fetch(
        GOOGLE_DRIVE_API,
        {
          cache: "no-store",
          signal:
            controller.signal
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "Google Drive API returned HTTP " +
        response.status
      );

    }


    const media =
      await response.json();


    if (
      !Array.isArray(media)
    ) {

      throw new Error(
        "Google Drive API returned invalid data."
      );

    }


    return media

      .filter(
        item =>
          item.type === "image"
      )

      .map(
        item => {

          if (
            item.src
          ) {

            return item;

          }


          return {
            ...item,

            src:
              "https://drive.google.com/thumbnail?id=" +
              encodeURIComponent(
                item.id
              ) +
              "&sz=w2000"

          };

        }
      );

  }

  finally {

    window.clearTimeout(
      timeout
    );

  }

}


// ============================================================
// LOAD LOCAL VIDEOS
// ============================================================

async function fetchLocalVideos() {

  const controller =
    new AbortController();


  const timeout =
    window.setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS
    );


  try {

    const response =
      await fetch(
        "/api/videos",
        {
          cache: "no-store",
          signal:
            controller.signal
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "Local video server returned HTTP " +
        response.status
      );

    }


    const files =
      await response.json();


    if (
      !Array.isArray(files)
    ) {

      return [];

    }


    return files

      .filter(
        file =>
          file &&
          file.type === "video" &&
          file.src
      )

      .map(
        file => ({

          name:
            file.name,

          type:
            "video",

          src:
            file.src

        })
      );

  }

  finally {

    window.clearTimeout(
      timeout
    );

  }

}


// ============================================================
// LOAD GITHUB ASSETS2 VIDEOS
// ============================================================

async function fetchGitHubVideos() {

  const repository =
    getGitHubRepository();


  if (
    !repository
  ) {

    return [];

  }


  const apiURL =
    "https://api.github.com/repos/" +
    encodeURIComponent(
      repository.owner
    ) +
    "/" +
    encodeURIComponent(
      repository.repo
    ) +
    "/contents/" +
    VIDEO_FOLDER;


  const controller =
    new AbortController();


  const timeout =
    window.setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS
    );


  try {

    const response =
      await fetch(
        apiURL,
        {
          headers: {
            "Accept":
              "application/vnd.github+json"
          },

          cache:
            "no-store",

          signal:
            controller.signal
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "GitHub returned HTTP " +
        response.status
      );

    }


    const files =
      await response.json();


    if (
      !Array.isArray(files)
    ) {

      return [];

    }


    return files

      .filter(
        file => {

          if (
            file.type !== "file"
          ) {

            return false;

          }


          const name =
            file.name.toLowerCase();


          return (
            name.endsWith(".mp4") ||
            name.endsWith(".webm") ||
            name.endsWith(".mov") ||
            name.endsWith(".m4v") ||
            name.endsWith(".ogv") ||
            name.endsWith(".ogg")
          );

        }
      )

      .map(
        file => ({

          name:
            file.name,

          type:
            "video",

          src:
            VIDEO_FOLDER +
            "/" +
            encodeURIComponent(
              file.name
            )

        })
      );

  }

  finally {

    window.clearTimeout(
      timeout
    );

  }

}


// ============================================================
// LOAD VIDEOS
// ============================================================

async function fetchVideos() {

  // ----------------------------------------------------------
  // LOCALHOST
  // ----------------------------------------------------------

  if (
    !window.location.hostname.endsWith(
      ".github.io"
    )
  ) {

    return await fetchLocalVideos();

  }


  // ----------------------------------------------------------
  // GITHUB PAGES
  // ----------------------------------------------------------

  return await fetchGitHubVideos();

}


// ============================================================
// LOAD ALL MEDIA
// ============================================================

async function fetchMedia() {

  const results =
    await Promise.allSettled([

      fetchDrivePhotos(),

      fetchVideos()

    ]);


  const photos =
    results[0].status === "fulfilled"
      ? results[0].value
      : [];


  const videosFromServer =
    results[1].status === "fulfilled"
      ? results[1].value
      : [];


  if (
    results[0].status === "rejected"
  ) {

    console.error(
      "Google Drive photos failed:",
      results[0].reason
    );

  }


  if (
    results[1].status === "rejected"
  ) {

    console.error(
      "Videos failed:",
      results[1].reason
    );

  }


  const allMedia = [

    ...photos,

    ...videosFromServer

  ];


  allMedia.sort(
    sortMedia
  );


  return allMedia;

}


// ============================================================
// LOAD PAGE
// ============================================================

async function loadMedia() {

  if (
    videoObserver
  ) {

    videoObserver.disconnect();

  }


  videos = [];


  setBusy(true);


  setLoadingState();


  try {

    const media =
      await fetchMedia();


    if (
      !media.length
    ) {

      showEmptyState();

      return;

    }


    const memories =
      document.createDocumentFragment();


    media.forEach(
      (item, index) => {

        memories.appendChild(
          addMediaFrame(
            item,
            index
          )
        );

      }
    );


    gallery.replaceChildren(
      memories
    );


    memoryCount.textContent =
      formatCount(
        media.length
      );


    setupVideoObserver();

  }

  catch (error) {

    showError(
      "Could not load the memories. " +
      error.message
    );


    console.error(
      "Unable to load gallery media:",
      error
    );

  }

  finally {

    setBusy(false);

  }

}


// ============================================================
// MUTE BUTTON
// ============================================================

// Sound is ON by default.
// The button can still manually mute/unmute
// if it exists in your existing design.

if (
  muteAll
) {

  muteAll.addEventListener(
    "click",
    () => {

      muted =
        !muted;


      videos.forEach(
        (video) => {

          video.muted =
            muted;

        }
      );


      const icon =
        muteAll.querySelector(
          "span"
        );


      if (icon) {

        icon.textContent =
          muted
            ? "🔇"
            : "🔊";

      }


      muteAll.setAttribute(
        "aria-label",
        muted
          ? "Unmute videos"
          : "Mute videos"
      );


      muteAll.title =
        muted
          ? "Unmute videos"
          : "Mute videos";

    }
  );

}


// ============================================================
// START
// ============================================================

loadMedia();

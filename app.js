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
// VIDEO FOLDER
// ============================================================

const VIDEO_FOLDER = "assets2";


// ============================================================
// STATE
// ============================================================

let videos = [];

let videoObserver = null;


// ============================================================
// VIDEO PLAY BUTTON STYLE
// ============================================================

const videoStyle = document.createElement("style");

videoStyle.textContent = `
/* =========================================================
   CUSTOM VIDEO PLAY BUTTON
   ========================================================= */

.frame {
  position: relative;
}


/* Large play button */

.custom-video-play {
  position: absolute;
  left: 50%;
  top: 50%;

  transform: translate(-50%, -50%);

  width: 78px;
  height: 78px;

  border: none;
  border-radius: 50%;

  background: rgba(0, 0, 0, 0.72);

  color: white;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 34px;
  line-height: 1;

  cursor: pointer;

  z-index: 20;

  padding: 0;

  box-shadow:
    0 5px 25px rgba(0, 0, 0, 0.35);

  transition:
    transform 0.18s ease,
    background 0.18s ease,
    opacity 0.18s ease;
}


.custom-video-play:hover {
  transform:
    translate(-50%, -50%)
    scale(1.08);

  background:
    rgba(0, 0, 0, 0.85);
}


.custom-video-play:active {
  transform:
    translate(-50%, -50%)
    scale(0.94);
}


/* Keyboard focus */

.custom-video-play:focus-visible {
  outline:
    3px solid white;

  outline-offset:
    4px;
}


/* Hide play button while video is playing */

.custom-video-play.hidden {
  opacity: 0;
  pointer-events: none;
}


/* Video itself */

.frame video {
  cursor: pointer;
}


/* Remove filename/caption completely */

.media-label {
  display: none !important;
}


/* Keep video colours original */

.frame video {
  opacity: 1 !important;
  filter: none !important;
}
`;

document.head.appendChild(videoStyle);


// ============================================================
// GITHUB REPOSITORY DETECTION
// ============================================================

function getGitHubRepository() {

  const host =
    window.location.hostname;

  const path =
    window.location.pathname;


  if (
    !host.endsWith(".github.io")
  ) {

    return null;

  }


  const owner =
    host.split(".")[0];


  const parts =
    path
      .split("/")
      .filter(Boolean);


  if (
    parts.length > 0
  ) {

    return {
      owner: owner,
      repo: parts[0]
    };

  }


  return {
    owner: owner,
    repo: owner + ".github.io"
  };

}


// ============================================================
// BASIC HELPERS
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


  gallery.appendChild(
    state
  );


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

function pauseOtherVideos(
  currentVideo
) {

  videos.forEach(
    (video) => {

      if (
        video !== currentVideo
      ) {

        if (
          !video.paused
        ) {

          video.pause();

        }

      }

    }
  );

}


// ============================================================
// SHOW / HIDE PLAY BUTTON
// ============================================================

function showPlayButton(
  button
) {

  button.classList.remove(
    "hidden"
  );

}


function hidePlayButton(
  button
) {

  button.classList.add(
    "hidden"
  );

}


// ============================================================
// PLAY VIDEO
// ============================================================

function playVideo(
  video,
  playButton
) {

  // First stop every other video.
  pauseOtherVideos(
    video
  );


  // ----------------------------------------------------------
  // AUDIO MUST BE ON
  // ----------------------------------------------------------

  video.muted =
    false;

  video.defaultMuted =
    false;

  video.volume =
    1;


  // ----------------------------------------------------------
  // PLAY ONLY AFTER USER CLICK
  // ----------------------------------------------------------

  const promise =
    video.play();


  if (
    promise &&
    typeof promise.catch === "function"
  ) {

    promise.catch(
      (error) => {

        console.warn(
          "Video could not start:",
          error
        );

        showPlayButton(
          playButton
        );

      }
    );

  }

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

    // --------------------------------------------------------
    // NEVER AUTOPLAY
    // --------------------------------------------------------

    media.autoplay =
      false;


    media.removeAttribute(
      "autoplay"
    );


    // --------------------------------------------------------
    // VIDEO SETTINGS
    // --------------------------------------------------------

    media.controls =
      false;


    media.loop =
      true;


    media.playsInline =
      true;


    media.preload =
      "metadata";


    // --------------------------------------------------------
    // AUDIO ON
    // --------------------------------------------------------

    media.muted =
      false;


    media.defaultMuted =
      false;


    media.volume =
      1;


    media.setAttribute(
      "aria-label",
      "Video"
    );


    // --------------------------------------------------------
    // CUSTOM PLAY BUTTON
    // --------------------------------------------------------

    const playButton =
      document.createElement(
        "button"
      );


    playButton.type =
      "button";


    playButton.className =
      "custom-video-play";


    playButton.innerHTML =
      "▶";


    playButton.setAttribute(
      "aria-label",
      "Play video"
    );


    playButton.title =
      "Play video";


    frame.appendChild(
      playButton
    );


    // --------------------------------------------------------
    // PLAY BUTTON CLICK
    // --------------------------------------------------------

    playButton.addEventListener(
      "click",
      (event) => {

        event.preventDefault();

        event.stopPropagation();


        // Always make sure audio is ON.
        media.muted =
          false;

        media.defaultMuted =
          false;

        media.volume =
          1;


        playVideo(
          media,
          playButton
        );

      }
    );


    // --------------------------------------------------------
    // WHEN VIDEO STARTS
    // --------------------------------------------------------

    media.addEventListener(
      "play",
      () => {

        // Pause all other videos.
        pauseOtherVideos(
          media
        );


        // Audio ON.
        media.muted =
          false;

        media.defaultMuted =
          false;

        media.volume =
          1;


        // Hide play icon.
        hidePlayButton(
          playButton
        );

      }
    );


    // --------------------------------------------------------
    // WHILE VIDEO IS ACTUALLY PLAYING
    // --------------------------------------------------------

    media.addEventListener(
      "playing",
      () => {

        media.muted =
          false;

        media.defaultMuted =
          false;

        media.volume =
          1;


        hidePlayButton(
          playButton
        );

      }
    );


    // --------------------------------------------------------
    // VIDEO PAUSED
    // --------------------------------------------------------

    media.addEventListener(
      "pause",
      () => {

        showPlayButton(
          playButton
        );

      }
    );


    // --------------------------------------------------------
    // VIDEO ENDED
    // --------------------------------------------------------

    media.addEventListener(
      "ended",
      () => {

        showPlayButton(
          playButton
        );

      }
    );


    // --------------------------------------------------------
    // TAP VIDEO TO PAUSE
    // --------------------------------------------------------

    media.addEventListener(
      "click",
      () => {

        if (
          !media.paused
        ) {

          media.pause();

          showPlayButton(
            playButton
          );

        }

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


  // Add image/video.
  frame.appendChild(
    media
  );


  // ==========================================================
  // HIDDEN CAPTION
  // ==========================================================

  const caption =
    document.createElement(
      "figcaption"
    );


  caption.className =
    "media-label";


  caption.style.display =
    "none";


  caption.textContent =
    item.name;


  frame.appendChild(
    caption
  );


  section.appendChild(
    frame
  );


  return section;

}


// ============================================================
// VIDEO SCROLL OBSERVER
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
            // NEVER PLAY HERE.
            //
            // Only pause when video leaves screen.
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
// GOOGLE DRIVE PHOTOS
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
// LOCALHOST VIDEOS
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
// GITHUB VIDEOS
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
// SELECT VIDEO SOURCE
// ============================================================

async function fetchVideos() {

  // LOCALHOST
  if (
    !window.location.hostname.endsWith(
      ".github.io"
    )
  ) {

    return await fetchLocalVideos();

  }


  // GITHUB PAGES
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


  // Stop existing videos.
  videos.forEach(
    (video) => {

      video.pause();

    }
  );


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
// DISABLE OLD GLOBAL MUTE BEHAVIOUR
// ============================================================

if (
  muteAll
) {

  // Hide the old global mute button because
  // videos must always start with audio ON.

  muteAll.style.display =
    "none";

}


// ============================================================
// START
// ============================================================

loadMedia();

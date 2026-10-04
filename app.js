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
// GITHUB VIDEO SETTINGS
// ============================================================

const VIDEO_FOLDER = "assets2";

// ============================================================
// STATE
// ============================================================

let videos = [];
let muted = false;

let videoLoadObserver = null;
let videoVisibilityObserver = null;

// ============================================================
// VIDEO EXTENSIONS
// ============================================================

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".ogv",
  ".ogg"
];

// ============================================================
// PERFORMANCE CSS
// ============================================================

function injectVideoStyles() {
  if (document.getElementById("optimized-video-styles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "optimized-video-styles";

  style.textContent = `
    .optimized-video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      cursor: pointer;
    }

    .custom-video-play {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);

      width: 72px;
      height: 72px;

      border: none;
      border-radius: 50%;

      background: rgba(0, 0, 0, 0.72);
      color: white;

      display: flex;
      align-items: center;
      justify-content: center;

      font-size: 30px;
      line-height: 1;

      cursor: pointer;

      z-index: 50;

      opacity: 1;
      visibility: visible;

      transition:
        opacity 0.2s ease,
        transform 0.2s ease;
    }

    .custom-video-play:hover {
      transform: translate(-50%, -50%) scale(1.08);
    }

    .custom-video-play.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .video-loading {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);

      width: 34px;
      height: 34px;

      border: 3px solid rgba(255,255,255,0.35);
      border-top-color: white;

      border-radius: 50%;

      animation: videoSpinner 0.8s linear infinite;

      z-index: 45;

      display: none;
    }

    .video-loading.show {
      display: block;
    }

    @keyframes videoSpinner {
      to {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }

    .frame {
      position: relative;
      contain: layout paint;
    }

    /* Hide filename captions */
    .media-label {
      display: none !important;
    }

    /* Hide old video badge */
    .video-badge {
      display: none !important;
    }

    /*
      Reserve a little space for videos before metadata
      is available. This prevents large layout jumps.
    */
    .lazy-video-frame {
      background: #000;
    }
  `;

  document.head.appendChild(style);
}

// ============================================================
// GITHUB REPOSITORY DETECTION
// ============================================================

function getGitHubRepository() {
  const host = window.location.hostname;
  const path = window.location.pathname;

  if (!host.endsWith(".github.io")) {
    return null;
  }

  const owner = host.split(".")[0];

  const parts = path
    .split("/")
    .filter(Boolean);

  if (!parts.length) {
    return null;
  }

  return {
    owner,
    repo: parts[0]
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
    detail.textContent = message;
  }

  const retry =
    errorState.querySelector(
      ".retry-button"
    );

  if (retry) {
    retry.addEventListener(
      "click",
      loadMedia
    );
  }

  gallery.replaceChildren(errorState);

  memoryCount.textContent =
    "Unable to load";
}

function createMediaFallback(
  frame,
  message
) {
  if (
    frame.querySelector(
      ".media-fallback"
    )
  ) {
    return;
  }

  const fallback =
    document.createElement("p");

  fallback.className =
    "media-fallback";

  fallback.textContent =
    message;

  frame.appendChild(fallback);
}

function formatCount(count) {
  return (
    count +
    (count === 1
      ? " memory"
      : " memories")
  );
}

// ============================================================
// SORTING
// happiness_1 ... happiness_15 FIRST
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
    if (aNumber !== bNumber) {
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

// ============================================================
// PAUSE ALL VIDEOS EXCEPT ONE
// ============================================================

function pauseOtherVideos(currentVideo) {
  videos.forEach(video => {
    if (
      video !== currentVideo &&
      !video.paused
    ) {
      video.pause();
    }
  });
}

// ============================================================
// UPDATE PLAY BUTTON
// ============================================================

function showPlayButton(video) {
  const button =
    video.parentElement.querySelector(
      ".custom-video-play"
    );

  if (button) {
    button.classList.remove("hidden");
  }
}

function hidePlayButton(video) {
  const button =
    video.parentElement.querySelector(
      ".custom-video-play"
    );

  if (button) {
    button.classList.add("hidden");
  }
}

// ============================================================
// LOAD ONE VIDEO
// ============================================================

function loadVideo(video) {
  if (!video) {
    return;
  }

  if (video.dataset.loaded === "true") {
    return;
  }

  const source =
    video.dataset.src;

  if (!source) {
    return;
  }

  video.src = source;

  video.preload = "metadata";

  video.dataset.loaded =
    "true";

  /*
    load() tells the browser to start reading
    the metadata without autoplaying.
  */
  try {
    video.load();
  } catch (error) {
    console.warn(
      "Could not load video:",
      error
    );
  }
}

// ============================================================
// UNLOAD ONE VIDEO
// ============================================================

function unloadVideo(video) {
  if (!video) {
    return;
  }

  /*
    Never unload a currently playing video.
  */
  if (!video.paused) {
    video.pause();
  }

  if (
    video.dataset.loaded !== "true"
  ) {
    return;
  }

  /*
    Remove source from the video element.
    This releases network/buffer memory.
  */
  video.removeAttribute("src");

  video.load();

  video.dataset.loaded =
    "false";

  showPlayButton(video);
}

// ============================================================
// PLAY VIDEO
// ============================================================

async function playVideo(video) {
  if (!video) {
    return;
  }

  /*
    Make sure this video is loaded first.
  */
  loadVideo(video);

  /*
    Only one video can play.
  */
  pauseOtherVideos(video);

  /*
    Sound ON.
  */
  video.muted = false;
  video.defaultMuted = false;
  video.volume = 1;

  try {
    await video.play();

    hidePlayButton(video);

  } catch (error) {
    console.warn(
      "Video play failed:",
      error
    );

    showPlayButton(video);
  }
}

// ============================================================
// CREATE VIDEO ELEMENT
// ============================================================

function createVideo(
  item,
  frame
) {
  const video =
    document.createElement("video");

  /*
    IMPORTANT:
    Do NOT put the real URL into src initially.

    The URL is stored in data-src.
    This prevents all videos from downloading
    immediately.
  */
  video.dataset.src =
    item.src;

  video.dataset.loaded =
    "false";

  video.className =
    "optimized-video";

  video.loop = true;

  video.playsInline = true;

  video.muted = false;

  video.defaultMuted = false;

  video.volume = 1;

  /*
    Metadata only after the video is near viewport.
  */
  video.preload = "none";

  video.controls = false;

  video.autoplay = false;

  video.removeAttribute(
    "autoplay"
  );

  video.setAttribute(
    "playsinline",
    ""
  );

  video.setAttribute(
    "webkit-playsinline",
    ""
  );

  video.setAttribute(
    "aria-label",
    item.name
  );

  // ----------------------------------------------------------
  // PLAY BUTTON
  // ----------------------------------------------------------

  const playButton =
    document.createElement("button");

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

  playButton.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      playVideo(video);
    }
  );

  // ----------------------------------------------------------
  // LOADING SPINNER
  // ----------------------------------------------------------

  const spinner =
    document.createElement("div");

  spinner.className =
    "video-loading";

  spinner.setAttribute(
    "aria-hidden",
    "true"
  );

  // ----------------------------------------------------------
  // METADATA
  // ----------------------------------------------------------

  video.addEventListener(
    "loadedmetadata",
    () => {
      if (
        video.videoWidth &&
        video.videoHeight
      ) {
        frame.style.aspectRatio =
          video.videoWidth +
          " / " +
          video.videoHeight;
      }

      frame.classList.add(
        "has-media"
      );
    }
  );

  // ----------------------------------------------------------
  // LOADING
  // ----------------------------------------------------------

  video.addEventListener(
    "loadstart",
    () => {
      spinner.classList.add(
        "show"
      );
    }
  );

  video.addEventListener(
    "loadeddata",
    () => {
      spinner.classList.remove(
        "show"
      );
    }
  );

  video.addEventListener(
    "canplay",
    () => {
      spinner.classList.remove(
        "show"
      );
    }
  );

  // ----------------------------------------------------------
  // PLAY
  // ----------------------------------------------------------

  video.addEventListener(
    "play",
    () => {
      pauseOtherVideos(video);
      hidePlayButton(video);
    }
  );

  video.addEventListener(
    "playing",
    () => {
      spinner.classList.remove(
        "show"
      );

      hidePlayButton(video);
    }
  );

  // ----------------------------------------------------------
  // PAUSE
  // ----------------------------------------------------------

  video.addEventListener(
    "pause",
    () => {
      spinner.classList.remove(
        "show"
      );

      showPlayButton(video);
    }
  );

  // ----------------------------------------------------------
  // ENDED
  // ----------------------------------------------------------

  video.addEventListener(
    "ended",
    () => {
      showPlayButton(video);
    }
  );

  // ----------------------------------------------------------
  // ERROR
  // ----------------------------------------------------------

  video.addEventListener(
    "error",
    () => {
      spinner.classList.remove(
        "show"
      );

      showPlayButton(video);

      /*
        Only show an error if the browser
        actually attempted to load the video.
      */
      if (
        video.dataset.loaded ===
        "true"
      ) {
        createMediaFallback(
          frame,
          "This video could not be previewed in this browser."
        );
      }
    }
  );

  // ----------------------------------------------------------
  // CLICK VIDEO TO PAUSE
  // ----------------------------------------------------------

  video.addEventListener(
    "click",
    () => {
      if (!video.paused) {
        video.pause();
      }
    }
  );

  // ----------------------------------------------------------
  // APPEND
  // ----------------------------------------------------------

  frame.appendChild(video);

  frame.appendChild(
    spinner
  );

  frame.appendChild(
    playButton
  );

  videos.push(video);

  return video;
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

  if (
    item.type === "video"
  ) {
    frame.classList.add(
      "lazy-video-frame"
    );

    createVideo(
      item,
      frame
    );
  }

  else {
    const image =
      document.createElement("img");

    image.src =
      item.src;

    image.alt =
      item.name;

    image.decoding =
      "async";

    /*
      Only the first few images load eagerly.
      Others remain lazy.
    */
    image.loading =
      index < 2
        ? "eager"
        : "lazy";

    image.addEventListener(
      "load",
      () => {
        if (
          image.naturalWidth &&
          image.naturalHeight
        ) {
          frame.style.aspectRatio =
            image.naturalWidth +
            " / " +
            image.naturalHeight;

          frame.classList.add(
            "has-media"
          );
        }
      }
    );

    image.addEventListener(
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

    frame.appendChild(
      image
    );
  }

  // ----------------------------------------------------------
  // HIDDEN CAPTION
  // ----------------------------------------------------------

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
    String(index + 1)
      .padStart(2, "0");

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
// VIDEO LAZY LOADING
// ============================================================

function setupVideoObservers() {
  /*
    Destroy old observers.
  */
  if (videoLoadObserver) {
    videoLoadObserver.disconnect();
  }

  if (videoVisibilityObserver) {
    videoVisibilityObserver.disconnect();
  }

  if (!videos.length) {
    return;
  }

  // ----------------------------------------------------------
  // LOAD VIDEOS NEAR SCREEN
  // ----------------------------------------------------------

  videoLoadObserver =
    new IntersectionObserver(
      entries => {
        entries.forEach(
          entry => {
            const video =
              entry.target;

            if (
              entry.isIntersecting
            ) {
              /*
                Load only when within
                approximately 2 screens.
              */
              loadVideo(video);
            }
          }
        );
      },
      {
        root: null,

        /*
          Start loading before the
          user reaches the video.
        */
        rootMargin:
          "1500px 0px 1500px 0px",

        threshold: 0
      }
    );

  // ----------------------------------------------------------
  // PAUSE / UNLOAD FAR VIDEOS
  // ----------------------------------------------------------

  videoVisibilityObserver =
    new IntersectionObserver(
      entries => {
        entries.forEach(
          entry => {
            const video =
              entry.target;

            if (
              entry.isIntersecting
            ) {
              /*
                Video is near the
                visible area.
              */
              loadVideo(video);
            }

            else {
              /*
                Do not keep videos
                playing while scrolling.
              */
              if (!video.paused) {
                video.pause();
              }
            }
          }
        );
      },
      {
        root: null,

        /*
          Video is considered
          "nearby" within about
          one viewport.
        */
        rootMargin:
          "800px 0px 800px 0px",

        threshold: 0.01
      }
    );

  videos.forEach(
    video => {
      videoLoadObserver.observe(
        video
      );

      videoVisibilityObserver.observe(
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

    if (!response.ok) {
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
          item.type ===
          "image"
      )
      .map(
        item => {
          /*
            If Apps Script already
            provides src, use it.
          */
          if (item.src) {
            return item;
          }

          /*
            Otherwise use Drive thumbnail.
          */
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
// LOAD GITHUB ASSETS2 VIDEOS
// ============================================================

async function fetchGitHubVideos() {
  const repository =
    getGitHubRepository();

  /*
    When running locally, use
    the local Node server.
  */
  if (!repository) {
    try {
      const response =
        await fetch(
          "/api/videos",
          {
            cache:
              "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          "Local video API returned HTTP " +
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
            file.type ===
              "video"
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

    catch (error) {
      console.error(
        "Local videos failed:",
        error
      );

      return [];
    }
  }

  // ----------------------------------------------------------
  // GITHUB PAGES
  // ----------------------------------------------------------

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
            Accept:
              "application/vnd.github+json"
          },

          cache:
            "no-store",

          signal:
            controller.signal
        }
      );

    if (!response.ok) {
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
            file.type !==
            "file"
          ) {
            return false;
          }

          const name =
            file.name.toLowerCase();

          return VIDEO_EXTENSIONS.some(
            extension =>
              name.endsWith(
                extension
              )
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
// LOAD ALL MEDIA
// ============================================================

async function fetchMedia() {
  const results =
    await Promise.allSettled([
      fetchDrivePhotos(),
      fetchGitHubVideos()
    ]);

  const photos =
    results[0].status ===
    "fulfilled"
      ? results[0].value
      : [];

  const githubVideos =
    results[1].status ===
    "fulfilled"
      ? results[1].value
      : [];

  if (
    results[0].status ===
    "rejected"
  ) {
    console.error(
      "Google Drive photos failed:",
      results[0].reason
    );
  }

  if (
    results[1].status ===
    "rejected"
  ) {
    console.error(
      "Videos failed:",
      results[1].reason
    );
  }

  const allMedia = [
    ...photos,
    ...githubVideos
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
  /*
    Clean up old observers.
  */
  if (videoLoadObserver) {
    videoLoadObserver.disconnect();
  }

  if (videoVisibilityObserver) {
    videoVisibilityObserver.disconnect();
  }

  /*
    Stop existing videos.
  */
  videos.forEach(
    video => {
      try {
        video.pause();
      } catch {}
    }
  );

  videos = [];

  setBusy(true);

  setLoadingState();

  try {
    const media =
      await fetchMedia();

    if (!media.length) {
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

    /*
      Now start the lazy-loading
      observers.
    */
    setupVideoObservers();
  }

  catch (error) {
    console.error(
      "Unable to load gallery media:",
      error
    );

    showError(
      "Could not load the memories. " +
      error.message
    );
  }

  finally {
    setBusy(false);
  }
}

// ============================================================
// MUTE / UNMUTE
// ============================================================

if (muteAll) {
  muteAll.addEventListener(
    "click",
    () => {
      muted = !muted;

      videos.forEach(
        video => {
          video.muted =
            muted;

          video.defaultMuted =
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

injectVideoStyles();

loadMedia();

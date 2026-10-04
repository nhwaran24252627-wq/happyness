const gallery =
  document.getElementById("gallery");

const memoryCount =
  document.getElementById("memoryCount");

const muteAll =
  document.getElementById("muteAll");

const emptyTemplate =
  document.getElementById("emptyTemplate");

const errorTemplate =
  document.getElementById("errorTemplate");


const REQUEST_TIMEOUT_MS = 15000;


// ============================================================
// GOOGLE DRIVE
// ============================================================

const GOOGLE_DRIVE_API =
  "https://script.google.com/macros/s/AKfycbzau-6zZkb0X3KM5gqgXKRfHVJi7s4OG2SfkKMSqGYD6L7845LE1KEf9AyYGCpwJDoM/exec";


// ============================================================
// VIDEO FOLDER
// ============================================================

const VIDEO_FOLDER =
  "assets2";


// ============================================================
// STATE
// ============================================================

let videos = [];

let muted = true;

let videoObserver = null;


// ============================================================
// BASIC HELPERS
// ============================================================

function setBusy(value) {

  gallery.setAttribute(
    "aria-busy",
    String(value)
  );
}


function formatCount(count) {

  return (
    count +
    (count === 1
      ? " memory"
      : " memories")
  );
}


function setLoadingState() {

  gallery.replaceChildren();

  const state =
    document.createElement(
      "section"
    );

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
    emptyTemplate.content.cloneNode(
      true
    )
  );

  memoryCount.textContent =
    "No memories yet";
}


function showError(message) {

  const errorState =
    errorTemplate.content.cloneNode(
      true
    );

  const detail =
    errorState.querySelector(
      ".error-detail"
    );

  if (detail) {
    detail.textContent =
      message;
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


  gallery.replaceChildren(
    errorState
  );

  memoryCount.textContent =
    "Unable to load";
}


// ============================================================
// SORTING
// happiness_1 → happiness_15 FIRST
// ============================================================

function getHappinessNumber(name) {

  const match =
    name.match(
      /^happiness[_ -]?0*(\d+)/i
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
// CREATE MEDIA FRAME
// ============================================================

function addMediaFrame(
  item,
  index
) {

  const section =
    document.createElement(
      "section"
    );

  section.className =
    "memory";

  section.style.setProperty(
    "--memory-index",
    index + 1
  );


  const frame =
    document.createElement(
      "figure"
    );

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

    media.loop = true;

    media.muted =
      muted;

    media.playsInline =
      true;

    media.controls =
      false;

    media.preload =
      index < 2
        ? "auto"
        : "metadata";


    media.setAttribute(
      "aria-label",
      item.name
    );


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


    media.addEventListener(
      "canplay",
      () => {

        frame.classList.add(
          "has-media"
        );

      }
    );


    media.addEventListener(
      "error",
      () => {

        console.error(
          "Video failed:",
          item.src,
          media.error
        );

        frame.classList.add(
          "media-error"
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

        console.error(
          "Image failed:",
          item.src
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
  // DO NOT SHOW FILE NAMES
  // ==========================================================

  section.appendChild(
    frame
  );


  return section;
}


// ============================================================
// VIDEO AUTOPLAY
// ============================================================

function setupVideoObserver() {

  if (videoObserver) {

    videoObserver.disconnect();

  }


  if (!videos.length) {
    return;
  }


  videoObserver =
    new IntersectionObserver(

      (entries) => {

        entries.forEach(
          (entry) => {

            const video =
              entry.target;


            if (
              entry.isIntersecting &&
              entry.intersectionRatio >= 0.65
            ) {

              video
                .play()
                .catch(
                  () => {}
                );

            } else {

              video.pause();

            }

          }
        );

      },

      {
        threshold: [
          0,
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
          signal: controller.signal
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
          item.type === "image"
      )

      .map(
        item => {

          if (item.src) {
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


  } finally {

    window.clearTimeout(
      timeout
    );

  }
}


// ============================================================
// GET GITHUB PAGE INFORMATION
// ============================================================

function getGitHubPageInfo() {

  const host =
    window.location.hostname;


  if (
    !host.endsWith(
      ".github.io"
    )
  ) {

    return null;

  }


  const owner =
    host.split(".")[0];


  const parts =
    window.location.pathname
      .split("/")
      .filter(Boolean);


  let basePath = "";


  // Project GitHub Pages
  //
  // username.github.io/repository/
  //

  if (parts.length > 0) {

    basePath =
      "/" +
      parts[0];

  }


  return {
    owner,
    basePath
  };
}


// ============================================================
// LOAD VIDEOS FROM LOCAL assets2
// ============================================================

async function fetchLocalVideos() {

  const response =
    await fetch(
      "/api/videos",
      {
        cache: "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      "Local video API returned HTTP " +
      response.status
    );

  }


  const data =
    await response.json();


  if (!Array.isArray(data)) {

    throw new Error(
      "Local video API returned invalid data."
    );

  }


  return data;
}


// ============================================================
// LOAD VIDEOS FROM GITHUB PAGES
// ============================================================

async function fetchGitHubVideos() {

  const pageInfo =
    getGitHubPageInfo();


  if (!pageInfo) {

    return [];

  }


  const apiURL =
    "https://api.github.com/repos/" +
    encodeURIComponent(
      pageInfo.owner
    ) +
    "/" +
    encodeURIComponent(
      getRepositoryName(pageInfo)
    ) +
    "/contents/" +
    VIDEO_FOLDER;


  const response =
    await fetch(
      apiURL,
      {
        headers: {
          "Accept":
            "application/vnd.github+json"
        },

        cache: "no-store"
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


  if (!Array.isArray(files)) {

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
      file => {

        return {

          name:
            file.name,

          type:
            "video",

          src:
            pageInfo.basePath +
            "/" +
            VIDEO_FOLDER +
            "/" +
            encodeURIComponent(
              file.name
            )

        };

      }
    );
}


// ============================================================
// FIND GITHUB REPOSITORY NAME
// ============================================================

function getRepositoryName(
  pageInfo
) {

  const parts =
    window.location.pathname
      .split("/")
      .filter(Boolean);


  // Project site:
  //
  // username.github.io/repository/
  //

  if (parts.length > 0) {

    return parts[0];

  }


  // User site:
  //
  // username.github.io/
  //

  return (
    pageInfo.owner +
    ".github.io"
  );
}


// ============================================================
// LOAD ALL MEDIA
// ============================================================

async function fetchMedia() {

  const isLocal =
    window.location.hostname ===
      "localhost" ||
    window.location.hostname ===
      "127.0.0.1";


  const results =
    await Promise.allSettled([

      fetchDrivePhotos(),

      isLocal
        ? fetchLocalVideos()
        : fetchGitHubVideos()

    ]);


  const photos =
    results[0].status ===
      "fulfilled"
      ? results[0].value
      : [];


  const videosFromSource =
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

    ...videosFromSource

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

  if (videoObserver) {

    videoObserver.disconnect();

  }


  videos = [];


  setBusy(true);

  setLoadingState();


  if (
    window.location.protocol ===
    "file:"
  ) {

    showError(
      "Please open the website through localhost:3000, not directly from the HTML file."
    );

    setBusy(false);

    return;
  }


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


    setupVideoObserver();


  } catch (error) {

    console.error(
      "Unable to load gallery:",
      error
    );


    showError(
      error.message ||
      "Could not load the memories."
    );


  } finally {

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

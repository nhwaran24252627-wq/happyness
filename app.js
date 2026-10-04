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


const GOOGLE_DRIVE_API =
  "https://script.google.com/macros/s/AKfycbzau-6zZkb0X3KM5gqgXKRfHVJi7s4OG2SfkKMSqGYD6L7845LE1KEf9AyYGCpwJDoM/exec";


const REQUEST_TIMEOUT_MS = 15000;

let videos = [];

let muted = true;

let videoObserver = null;


// ============================================================
// LOADING
// ============================================================

function setBusy(value) {
  gallery.setAttribute(
    "aria-busy",
    String(value)
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

  const state =
    errorTemplate.content.cloneNode(true);

  const detail =
    state.querySelector(
      ".error-detail"
    );

  if (detail) {
    detail.textContent =
      message;
  }

  const retry =
    state.querySelector(
      ".retry-button"
    );

  if (retry) {
    retry.addEventListener(
      "click",
      loadMedia
    );
  }

  gallery.replaceChildren(state);

  memoryCount.textContent =
    "Unable to load";
}


// ============================================================
// SORTING
// ============================================================

function getHappinessNumber(name) {

  const match =
    name.match(
      /^happiness[_ -]?(\d+)/i
    );

  if (!match) {
    return Infinity;
  }

  return Number(match[1]);
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
        aNumber - bNumber
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
// CREATE MEDIA
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
            `${media.videoWidth} / ${media.videoHeight}`;

          frame.classList.add(
            "has-media"
          );
        }
      }
    );


    media.addEventListener(
      "error",
      () => {

        createFallback(
          frame,
          "This video could not be previewed in this browser."
        );

      },
      {
        once: true
      }
    );


    videos.push(media);


    const badge =
      document.createElement(
        "span"
      );

    badge.className =
      "video-badge";

    badge.textContent =
      "Video";

    frame.appendChild(badge);

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
            `${media.naturalWidth} / ${media.naturalHeight}`;

          frame.classList.add(
            "has-media"
          );
        }
      }
    );


    media.addEventListener(
      "error",
      () => {

        createFallback(
          frame,
          "This image could not be previewed."
        );

      },
      {
        once: true
      }
    );
  }


  frame.appendChild(media);


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
// FALLBACK
// ============================================================

function createFallback(
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
    document.createElement(
      "p"
    );

  fallback.className =
    "media-fallback";

  fallback.textContent =
    message;

  frame.appendChild(
    fallback
  );
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
      entries => {

        entries.forEach(
          entry => {

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
    video => {

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
    setTimeout(
      () => controller.abort(),
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
        "Google Drive returned HTTP " +
        response.status
      );
    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {

      throw new Error(
        "Google Drive returned invalid data."
      );
    }


    return data
      .filter(
        item =>
          item &&
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

    clearTimeout(
      timeout
    );
  }
}


// ============================================================
// LOCAL ASSETS2 VIDEOS
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
      "Local video server returned HTTP " +
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
// LOAD EVERYTHING
// ============================================================

async function fetchMedia() {

  const results =
    await Promise.allSettled([
      fetchDrivePhotos(),
      fetchLocalVideos()
    ]);


  const photos =
    results[0].status === "fulfilled"
      ? results[0].value
      : [];


  const localVideos =
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
      "Local videos failed:",
      results[1].reason
    );
  }


  const allMedia = [
    ...photos,
    ...localVideos
  ];


  allMedia.sort(
    sortMedia
  );


  return allMedia;
}


// ============================================================
// LOAD GALLERY
// ============================================================

async function loadMedia() {

  if (videoObserver) {
    videoObserver.disconnect();
  }


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


    const fragment =
      document.createDocumentFragment();


    media.forEach(
      (item, index) => {

        fragment.appendChild(
          addMediaFrame(
            item,
            index
          )
        );
      }
    );


    gallery.replaceChildren(
      fragment
    );


    memoryCount.textContent =
      media.length +
      (
        media.length === 1
          ? " memory"
          : " memories"
      );


    setupVideoObserver();

  } catch (error) {

    console.error(
      "Gallery error:",
      error
    );


    showError(
      error.message
    );

  } finally {

    setBusy(false);
  }
}


// ============================================================
// MUTE / UNMUTE
// ============================================================

muteAll.addEventListener(
  "click",
  () => {

    muted =
      !muted;


    videos.forEach(
      video => {

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


// ============================================================
// START
// ============================================================

loadMedia();
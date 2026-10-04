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


// ============================================================
// GOOGLE DRIVE APPS SCRIPT
// ============================================================

const GOOGLE_DRIVE_API =
  "https://script.google.com/macros/s/AKfycbzau-6zZkb0X3KM5gqgXKRfHVJi7s4OG2SfkKMSqGYD6L7845LE1KEf9AyYGCpwJDoM/exec";


// ============================================================
// SETTINGS
// ============================================================

const REQUEST_TIMEOUT = 15000;

let videos = [];

let muted = true;

let videoObserver = null;


// ============================================================
// LOADING
// ============================================================

function showLoading() {

  gallery.replaceChildren();

  const section =
    document.createElement("section");

  section.className =
    "state-card loading-state";

  section.innerHTML = `
    <div
      class="loading-orbit"
      aria-hidden="true"
    >✦</div>

    <p class="state-kicker">
      Just a moment
    </p>

    <h2>
      Loading memories…
    </h2>

    <p>
      Reading the memories.
    </p>
  `;

  gallery.appendChild(section);

  memoryCount.textContent =
    "Preparing memories";
}


// ============================================================
// EMPTY
// ============================================================

function showEmpty() {

  gallery.replaceChildren(
    emptyTemplate.content.cloneNode(true)
  );

  memoryCount.textContent =
    "No memories yet";
}


// ============================================================
// ERROR
// ============================================================

function showError(message) {

  const state =
    errorTemplate.content.cloneNode(true);

  const detail =
    state.querySelector(".error-detail");

  if (detail) {
    detail.textContent =
      message;
  }

  const retry =
    state.querySelector(".retry-button");

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
// HAPPINESS SORTING
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


  // happiness_1 to happiness_15
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


  // Everything else
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

function createMedia(item) {

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

    media.loop =
      true;

    media.muted =
      muted;

    media.playsInline =
      true;

    media.controls =
      false;

    media.preload =
      "metadata";


    media.setAttribute(
      "aria-hidden",
      "true"
    );


    // --------------------------------------------------------
    // VIDEO DIMENSIONS
    // --------------------------------------------------------

    media.addEventListener(
      "loadedmetadata",
      () => {

        const frame =
          media.closest(".frame");


        if (!frame) {
          return;
        }


        if (
          media.videoWidth &&
          media.videoHeight
        ) {

          frame.style.aspectRatio =
            `${media.videoWidth} / ${media.videoHeight}`;
        }


        // IMPORTANT:
        // Removes the loading/dimmed state

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
          item.src
        );

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
      "";

    media.loading =
      "lazy";

    media.decoding =
      "async";


    // --------------------------------------------------------
    // IMAGE LOADED
    // --------------------------------------------------------

    media.addEventListener(
      "load",
      () => {

        const frame =
          media.closest(".frame");


        if (!frame) {
          return;
        }


        if (
          media.naturalWidth &&
          media.naturalHeight
        ) {

          frame.style.aspectRatio =
            `${media.naturalWidth} / ${media.naturalHeight}`;
        }


        // IMPORTANT:
        // Makes the photo full original brightness

        frame.classList.add(
          "has-media"
        );

      }
    );


    media.addEventListener(
      "error",
      () => {

        console.error(
          "Image failed:",
          item.src
        );

      }
    );

  }


  return media;
}


// ============================================================
// CREATE FRAME
// NO FILENAMES
// NO CAPTIONS
// ============================================================

function createFrame(
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
    createMedia(item);


  // ONLY IMAGE OR VIDEO
  // No filename
  // No caption
  // No video badge

  frame.appendChild(
    media
  );


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
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT
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
        "Google Drive HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (
      !Array.isArray(data)
    ) {

      throw new Error(
        "Invalid Google Drive response"
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

          let src =
            item.src;


          if (
            !src &&
            item.id
          ) {

            src =
              "https://drive.google.com/thumbnail?id=" +
              encodeURIComponent(
                item.id
              ) +
              "&sz=w2000";

          }


          return {

            name:
              item.name ||
              "image",

            type:
              "image",

            src

          };

        }
      )

      .filter(
        item =>
          item.src
      );

  }

  finally {

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
        cache:
          "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      "assets2 HTTP " +
      response.status
    );

  }


  const data =
    await response.json();


  if (
    !Array.isArray(data)
  ) {

    throw new Error(
      "Invalid assets2 response"
    );

  }


  return data;
}


// ============================================================
// FETCH ALL MEDIA
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
      "Google Drive error:",
      results[0].reason
    );

  }


  if (
    results[1].status === "rejected"
  ) {

    console.error(
      "assets2 error:",
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


  gallery.setAttribute(
    "aria-busy",
    "true"
  );


  showLoading();


  try {

    const media =
      await fetchMedia();


    if (
      media.length === 0
    ) {

      showEmpty();

      return;
    }


    const fragment =
      document.createDocumentFragment();


    media.forEach(
      (item, index) => {

        fragment.appendChild(
          createFrame(
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

    gallery.setAttribute(
      "aria-busy",
      "false"
    );

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

  }
);


// ============================================================
// START
// ============================================================

loadMedia();

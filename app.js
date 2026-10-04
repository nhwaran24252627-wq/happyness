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
// DETECT GITHUB
// ============================================================

function getGitHubInfo() {

  const hostname =
    window.location.hostname;

  // ----------------------------------------------------------
  // Not GitHub
  // ----------------------------------------------------------

  if (
    !hostname.endsWith(
      "github.io"
    )
  ) {

    return null;
  }


  // ----------------------------------------------------------
  // GitHub Pages
  //
  // Example:
  // username.github.io/repository/
  // ----------------------------------------------------------

  const username =
    hostname.split(".")[0];


  const parts =
    window.location.pathname
      .split("/")
      .filter(Boolean);


  if (!parts.length) {

    // User/organization page
    return {
      username,
      repository:
        `${username}.github.io`
    };
  }


  return {

    username,

    repository:
      parts[0]

  };
}


// ============================================================
// GITHUB ASSETS2
// ============================================================

async function fetchGitHubVideos() {

  const github =
    getGitHubInfo();


  // ----------------------------------------------------------
  // If localhost, don't use GitHub
  // ----------------------------------------------------------

  if (!github) {

    return [];
  }


  const apiUrl =
    `https://api.github.com/repos/` +
    `${encodeURIComponent(github.username)}/` +
    `${encodeURIComponent(github.repository)}/` +
    `contents/assets2`;


  const response =
    await fetch(
      apiUrl,
      {
        cache: "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      "GitHub assets2 HTTP " +
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


  // ----------------------------------------------------------
  // Only video files
  // ----------------------------------------------------------

  const videoExtensions = [
    ".mp4",
    ".webm",
    ".mov",
    ".m4v",
    ".ogv",
    ".ogg"
  ];


  return files

    .filter(
      file =>
        file.type === "file"
    )

    .filter(
      file => {

        const name =
          file.name.toLowerCase();

        return videoExtensions.some(
          extension =>
            name.endsWith(extension)
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
            `https://raw.githubusercontent.com/` +
            `${github.username}/` +
            `${github.repository}/` +
            `main/assets2/` +
            encodeURIComponent(
              file.name
            )

        };

      }
    );
}


// ============================================================
// LOCAL ASSETS2
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
      "Local assets2 HTTP " +
      response.status
    );
  }


  const data =
    await response.json();


  if (
    !Array.isArray(data)
  ) {

    return [];
  }


  return data;
}


// ============================================================
// GET VIDEOS
// LOCAL OR GITHUB
// ============================================================

async function fetchVideos() {

  const github =
    getGitHubInfo();


  // ----------------------------------------------------------
  // GitHub Pages
  // ----------------------------------------------------------

  if (github) {

    console.log(
      "Loading videos from GitHub assets2..."
    );


    return await fetchGitHubVideos();
  }


  // ----------------------------------------------------------
  // Localhost
  // ----------------------------------------------------------

  console.log(
    "Loading videos from local assets2..."
  );


  return await fetchLocalVideos();
}


// ============================================================
// HAPPINESS SORTING
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
    getHappinessNumber(
      a.name
    );


  const bNumber =
    getHappinessNumber(
      b.name
    );


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
          cache:
            "no-store",

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
          item.type ===
          "image"
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


    media.addEventListener(
      "loadedmetadata",
      () => {

        const frame =
          media.closest(
            ".frame"
          );


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


    media.addEventListener(
      "load",
      () => {

        const frame =
          media.closest(
            ".frame"
          );


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
// ============================================================

function createFrame(
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
    createMedia(
      item
    );


  // ONLY MEDIA
  //
  // No filename
  // No caption
  // No label

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

            }

            else {

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
// GET ALL MEDIA
// ============================================================

async function fetchMedia() {

  // ----------------------------------------------------------
  // Load photos and videos at same time
  // ----------------------------------------------------------

  const results =
    await Promise.allSettled([

      fetchDrivePhotos(),

      fetchVideos()

    ]);


  const photos =
    results[0].status ===
    "fulfilled"

      ? results[0].value

      : [];


  const videoList =
    results[1].status ===
    "fulfilled"

      ? results[1].value

      : [];


  // ----------------------------------------------------------
  // Errors
  // ----------------------------------------------------------

  if (
    results[0].status ===
    "rejected"
  ) {

    console.error(
      "Google Drive error:",
      results[0].reason
    );

  }


  if (
    results[1].status ===
    "rejected"
  ) {

    console.error(
      "Video loading error:",
      results[1].reason
    );

  }


  // ----------------------------------------------------------
  // Combine
  // ----------------------------------------------------------

  const allMedia = [

    ...photos,

    ...videoList

  ];


  // ----------------------------------------------------------
  // Sort
  // ----------------------------------------------------------

  allMedia.sort(
    sortMedia
  );


  console.log(
    "Total media:",
    allMedia.length
  );


  console.log(
    "Photos:",
    photos.length
  );


  console.log(
    "Videos:",
    videoList.length
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


  }

  catch (error) {

    console.error(
      "Gallery error:",
      error
    );


    showError(
      error.message
    );

  }

  finally {

    gallery.setAttribute(
      "aria-busy",
      "false"
    );

  }
}


// ============================================================
// MUTE BUTTON
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

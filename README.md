# Happiness memory gallery

This gallery reads the media files in the local <code>assets</code> folder. It must be opened through its included local server, not by double-clicking <code>public/index.html</code>.

## Run it

1. Open a terminal in this folder.
2. Run <code>npm start</code>.
3. Open <a href="http://localhost:3000">http://localhost:3000</a> in a browser.

No <code>npm install</code> step is required. The server uses Node's built-in modules only.

## Add memories

Put photo and video files directly inside <code>assets</code>. Their original filenames remain unchanged in the gallery. The server recognizes JPG, JPEG, PNG, WebP, GIF, AVIF, HEIC, HEIF, MP4, WebM, MOV, M4V, OGV, and OGG files.

Files named <code>happiness_1</code> through <code>happiness_15</code> are ordered first (the project also recognizes the existing <code>happyness_</code> spelling and <code>happiness-01</code> style names). Every other supported file follows in natural filename order.

Each frame adapts to the natural portrait, square, or landscape aspect ratio of the source. A browser that cannot preview a format, such as some HEIC files, shows an in-gallery message instead of holding the page on a loader.

## If the gallery shows an error

The page waits at most six seconds for <code>/api/media</code>. If the server is not running, it explains exactly how to start it. If port 3000 is already in use, start it on a different port in a Windows terminal:

    $env:PORT=3001
    npm start

Then open <code>http://localhost:3001</code>.

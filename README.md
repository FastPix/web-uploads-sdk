# Resumable, chunked file uploads for the browser

[![npm version](https://img.shields.io/npm/v/@fastpix/resumable-uploads)](https://www.npmjs.com/package/@fastpix/resumable-uploads)
[![npm downloads](https://img.shields.io/npm/dm/@fastpix/resumable-uploads)](https://www.npmjs.com/package/@fastpix/resumable-uploads)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/@fastpix/resumable-uploads)](https://bundlephobia.com/package/@fastpix/resumable-uploads)
[![License](https://img.shields.io/github/license/FastPix/web-uploads-sdk)](./LICENSE)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-blue?logo=typescript)](https://www.typescriptlang.org/)

Upload large files from the browser without the fragility. This SDK splits a file into chunks and adds pause/resume, automatic retries with exponential backoff, and real-time progress events, so large uploads survive flaky networks. It's a headless upload engine, not a UI kit: you get the methods (pause(), resume(), abort()) and lifecycle events to wire into your own upload button, progress bar, and controls - you build the interface, and the SDK handles the chunking, retries, and network recovery. Written in TypeScript, works with plain JavaScript or any framework, via npm or a CDN.

> This SDK is designed to work with FastPix - it uploads to a FastPix signed URL - and is not a general-purpose uploads SDK.

**Works with:** Browsers · JavaScript · TypeScript · any framework · npm or CDN

📖 **Docs:** https://fastpix.com/docs/upload-videos/set-up-resumable-uploads-for-web &nbsp;·&nbsp; 

🚀 **Free account:** https://dashboard.fastpix.com

<br />

## Why this SDK?

- **Chunked large-file uploads** - files are split into configurable chunks (default 16 MB) so big uploads are reliable.
- **Pause and resume** - temporarily pause an upload and resume it later.
- **Automatic retry** - individual chunks retry up to 5 times with exponential backoff to recover from temporary network failures.
- **Lifecycle events** - subscribe to progress, success, error and chunk events for real-time feedback.
- **Robust error handling** - upload failures are surfaced gracefully so you can inform users.
- **Customizable** - tune chunk size, retries and stall/connection behavior to your network conditions.

<br />


## Features:

- **Chunking:** Files are automatically split into chunks (configurable, default size is 16MB/chunk).
- **Pause and Resume:** Allows temporarily pausing the upload and resuming after a while.
- **Retry:** Uploads might fail due to temporary network failures. Individual chunks are retried for 5 times with exponential backoff to recover automatically from such failures.
- **Lifecycle Event Listeners:** Listen to various upload lifecycle events to provide real-time feedback to users.
- **Error Handling and Reporting:** Comprehensive error handling to manage upload failures gracefully and inform users of issues.
- **Customizability:** Developers can customize the chunk size and retry attempts based on their specific needs and network conditions.

<br />


## Before you begin

To use the SDK, you need a FastPix account and a signed upload URL.

You need the following:

- A FastPix **Access Key** and **Secret Key** to authenticate API requests.
- A media file to upload.
- A FastPix signed upload URL generated using the [Upload media from device](https://fastpix.com/docs/video-on-demand-api/upload-and-import-videos/direct-upload-video-media) API.

See the [Activate your account](https://fastpix.com/docs/getting-started/activate-your-account) guide for information about retrieving your FastPix API credentials.

> **Security:** Do not expose your Access Key or Secret Key in browser-side code. Generate the signed upload URL from a secure server-side environment and pass only the signed URL to the browser.

<br />

## Generate a signed upload URL

`Uploader.init()` needs a **signed upload URL** as its `endpoint`. Generate it on your **server** with the FastPix [Upload media from device](https://fastpix.com/docs/video-on-demand-api/input-video/direct-upload-video-media) API, then pass only the returned URL to the browser.

Authenticate with Basic Auth - your **Access Token ID** as the username and **Secret Key** as the password:

```bash
curl -X POST https://api.fastpix.com/v1/on-demand/upload \
  -H "Content-Type: application/json" \
  -u "<ACCESS_TOKEN_ID>:<SECRET_KEY>" \
  -d '{
    "corsOrigin": "*",
    "pushMediaSettings": {
      "accessPolicy": "public",
      "metadata": { "key1": "value1" },
      "maxResolution": "1080p",
      "mediaQuality": "standard"
    }
  }'
```

The response returns the signed URL as `data.url` - that is the value you pass to `Uploader.init({ endpoint })`:

```json
{
  "success": true,
  "data": {
    "uploadId": "...",
    "url": "https://storage.googleapis.com/..."
  }
}
```

Set **`corsOrigin`** to the origin of your browser app (for example `http://localhost:5173` in local development, or your production origin), or `"*"` to allow any origin. If it does not match, browser uploads fail with a CORS error.

For the full request schema and all `pushMediaSettings` options, see the [Upload media from device](https://fastpix.com/docs/video-on-demand-api/input-video/direct-upload-video-media) API reference.

> **Security:** Generate the signed URL from a secure server-side environment. Never expose your Access Token ID or Secret Key in browser-side code - pass only the signed URL to the browser.


<br />



## Install the large-file upload SDK

To install the SDK, you can use NPM, CDN, or your preferred package manager:

### Using NPM:

```bash
npm i @fastpix/resumable-uploads
```

### Using CDN:

```bash
<script src="https://cdn.jsdelivr.net/npm/@fastpix/resumable-uploads@latest/dist/uploads.js"></script>
```

<br />

<br />

## How to upload a file

### Import

```javascript
import { Uploader } from "@fastpix/resumable-uploads";
```

### Initialize the uploader

```javascript
try {
  const fileUploader = Uploader.init({
    endpoint: "https://example.com/signed-url", // Replace with the signed URL.
    file: mediaFile, // Provide the media file you want to upload. From <input type="file" />
    chunkSize: 5 * 1024, // Minimum allowed chunk size is 5120KB (5MB).

    // Additional optional parameters can be specified here as needed
  });
} catch (error) {
  // Handle initialization errors, such as invalid configuration or missing file
  console.error("Failed to initialize uploads:", error?.message);
}
```

### Select a file from the browser

The `file` parameter accepts a browser `File` object. You can get the file from an HTML `<input type="file">` element and pass the selected file to `Uploader.init()`.

For example:

```html
<input type="file" id="fileInput" />
```
The `endpoint` parameter must contain the signed upload URL generated using the FastPix Upload API.

<br />

## How the upload works

The upload process consists of two steps:

1. Generate a signed upload URL using the FastPix Upload API.
2. Pass the signed upload URL and the selected file to `Uploader.init()`.

The SDK then splits the file into chunks and uploads the chunks to the signed URL.

```text
Your server
    |
    | Generate signed upload URL
    v
FastPix Upload API
    |
    | Signed upload URL
    v
Browser
    |
    | Uploader.init({ endpoint, file })
    v
FastPix
    |
    | Chunked upload
    v
Uploaded media
```
Your browser application only needs the signed upload URL. Your FastPix credentials should remain on the server.

<br />

## Monitor upload progress through lifecycle events

```javascript
// Track upload progress
fileUploader.on("progress", (event) => {
  console.log("Upload Progress:", event.detail.progress);
});

// Handle errors during the upload process
fileUploader.on("error", (event) => {
  console.error("Upload Error:", event.detail.message);
});

// Trigger actions when the upload completes successfully
fileUploader.on("success", (event) => {
  console.log("Upload Completed");
});

// Track the initiation of each chunk upload
fileUploader.on("chunkAttempt", (event) => {
  console.log("Chunk Upload Attempt:", event.detail);
});

// Track failures of each chunk upload attempt
fileUploader.on("chunkAttemptFailure", (event) => {
  console.log("Chunk Attempt Failure:", event.detail);
});

// Perform an action when a chunk is successfully uploaded
fileUploader.on("chunkSuccess", (event) => {
  console.log("Chunk Successfully Uploaded:", event.detail);
});

// Triggers when the connection is back online
fileUploader.on("online", (event) => {
  console.log("Connection Online");
});

// Triggers when the connection goes offline
fileUploader.on("offline", (event) => {
  console.log("Connection Offline");
});
```

<br />

### Verify the integration

To verify that the integration is working:

1. Start your browser application.
2. Select a media file using the file input.
3. Generate a signed upload URL using the FastPix Upload API.
4. Pass the signed upload URL and selected file to `Uploader.init()`.
5. Start the upload and monitor the `progress` event.
6. Confirm that the `success` event is triggered when the upload completes.
7. Verify that the uploaded media is available in your FastPix account.

If the upload does not complete, check the `error` event and see the [Troubleshooting](#troubleshooting) section.

<br />

## Pause, resume and abort an upload

You can control the upload lifecycle with the following methods:

- **Pause an Upload:**

  ```javascript
  fileUploader.pause(); // Pauses the current upload
  ```

- **Resume an Upload:**

  ```javascript
  fileUploader.resume(); // Resume the current upload
  ```

- **Abort an Upload:**

  ```javascript
  fileUploader.abort(); // Abort the current upload
  ```

  <br />

## Configuration parameters

The upload function accepts the following parameters:

| Name                | Type                                | Required | Description                                                                                                                                                   |
| ------------------- | ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `endpoint`          | `string` or `() => Promise<string>` | Required | The signed URL endpoint where the file will be uploaded. Can be a static string or a function returning a `Promise` that resolves to the upload URL.          |
| `file`              | `File` or `Object`                  | Required | The file object to be uploaded. Typically a `File` retrieved from an `<input type="file" />` element, but can also be a generic object representing the file. |
| `chunkSize`         | `number` (in KB)                    | Optional | Size of each chunk in kilobytes. Default is `16384` KB (16 MB).<br>**Minimum:** 5120 KB (5 MB), **Maximum:** 512000 KB (500 MB).                              |
| `maxFileSize`       | `number` (in KB)                    | Optional | Maximum allowed file size for upload, specified in kilobytes. Files exceeding this limit will be rejected.                                                    |
| `retryChunkAttempt` | `number`                            | Optional | Number of retry attempts per chunk in case of failure. Default is `5`.                                                                                        |
| `delayRetry`        | `number` (in seconds)               | Optional | Delay between retry attempts after a failed chunk upload. Default is `1` second.                                                                              |
| `stallTimeout`      | `number` (in seconds)               | Optional | Time without any upload progress before the in-flight chunk request is treated as stalled, aborted and retried on a fresh connection. Default is `30` seconds, minimum `1`. |
| `connectionRefreshInterval` | `number` (in seconds)       | Optional | Time a chunk request may keep running before the connection is re-established, continuing from the last byte the server committed. This recovers connections stuck at a stale speed (e.g. a transfer that started on a slow network staying slow after conditions improve). Backs off automatically on genuinely slow networks. Default is `45` seconds, minimum `5`. |

<br />

<br />

### Example usage of integrating all parameters with `Uploader.init`

```js
// Get the selected file from the input
const selectedFile = document.querySelector("#fileInput").files[0];

try {
  const fileUploader = Uploader.init({
    endpoint: "https://example.com/signed-url", // Signed URL for uploading
    file: selectedFile, // File or Object to upload
    chunkSize: 10 * 1024, // 10 MB per chunk
    maxFileSize: 100 * 1024, // 100 MB max file size
    retryChunkAttempt: 6, // Retry each failed chunk up to 6 times
    delayRetry: 2, // Wait 2 seconds between retry attempts
  });
} catch (error) {
  // Handle initialization errors
  console.error("Failed to initialize upload:", error?.message);
}
```

<br />

<br />

## Which FastPix upload SDK for your platform

Uploading from a different platform or framework? FastPix has a resumable upload SDK for each.

| Platform / framework | FastPix upload SDK |
|---|---|
| Web (this repo) | **web-uploads-sdk** |
| React (web) | [react-web-uploader](https://github.com/FastPix/react-web-uploader) |
| Astro | [astro-web-uploader](https://github.com/FastPix/astro-web-uploader) |
| Android | [android-uploads-sdk](https://github.com/FastPix/android-uploads-sdk) |
| iOS | [iOS-Uploads](https://github.com/FastPix/iOS-Uploads) |
| Flutter | [flutter-uploads](https://github.com/FastPix/flutter-uploads) |
| React Native | [react-native-uploader](https://github.com/FastPix/react-native-uploader) |

<br />

<br />

## FAQ

**How do I upload large files from the browser?**


Generate a FastPix signed URL, then call `Uploader.init({ endpoint, file })` with the file from an `<input type="file" />`. The SDK chunks the file and uploads it, as shown in "How to upload a file."

**Where should I generate the signed upload URL?**

Generate the signed upload URL from your server using the [FastPix Upload API](https://fastpix.com/docs/video-on-demand-api/input-video/direct-upload-video-media). Do not expose your FastPix Access Key or Secret Key in browser-side code. Pass only the signed upload URL to the browser. Refer to [Generate JWTs for secure media](https://fastpix.com/docs/video-security/generate-jwts-for-secure-media) guide.

**How do I pause and resume an upload?**


Use `fileUploader.pause()` and `fileUploader.resume()` on the instance returned by `Uploader.init`. See "Pause, resume and abort an upload."

**What happens if a chunk fails or the network drops?**


Each chunk retries automatically (up to `retryChunkAttempt`, default 5) with exponential backoff, and the SDK emits `online`/`offline` events so you can react to connectivity changes.

**Can I set the chunk size and maximum file size?**


Yes - `chunkSize` (min 5 MB, max 500 MB; default 16 MB) and `maxFileSize`. See "Configuration parameters."

**How do I track upload progress?**


Listen to the `progress` lifecycle event, plus `success`, `error` and the per-chunk events. See "Monitor upload progress through lifecycle events."

**Does it support TypeScript?**


The SDK is written in TypeScript.

**Can I use it without npm?**


Yes - load it from a CDN with the `<script>` tag shown under "Install the large-file upload SDK."

**Do I need a FastPix account?**


Yes. The SDK uploads to a FastPix signed URL, so you need FastPix credentials. It is not a general-purpose uploader.

<br />

<br />

## Troubleshooting

- **`Uploader.init` throws?** 
  
  Check that `endpoint` is a valid signed URL and that a `file` was provided.

- **CORS error when uploading?** 

  Check that `corsOrigin` matches the origin of the browser application. For local development, make sure it matches the origin and port used by your local application.

- **Chunk size rejected?** 
  
  `chunkSize` must be at least 5120 KB (5 MB) and at most 512000 KB (500 MB).

- **Uploads stall on slow or flaky networks?** 
  
  Tune `stallTimeout` and `connectionRefreshInterval` (see "Configuration parameters").

- **Need to surface failures to users?** 

  Listen to the `error` event.

## References
 
[FastPix Homepage](https://www.fastpix.com/)
[FastPix Dashboard](https://dashboard.fastpix.com/)
[Uploads github](https://github.com/FastPix/web-uploads-sdk)

## Detailed Usage:

For more detailed steps and advanced usage, please refer to the official [FastPix Documentation](https://fastpix.com/docs/upload-videos/set-up-resumable-uploads-for-web).

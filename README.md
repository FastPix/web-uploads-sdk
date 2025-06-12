# Uploads SDK

This SDK helps you efficiently upload large files from the browser by splitting them into chunks and also gives you the ability to pause and resume your uploads. While the SDK itself is written in TypeScript, we are publishing only the JavaScript output as npm package. Types support for TypeScript users will be released in a later version.

Please note that this SDK is designed to work only with FastPix and is not a general purpose uploads SDK.

# Features:

- **Chunking:** Files are automatically split into chunks (configurable, default size is 16MB/chunk).
- **Pause and Resume:** Allows temporarily pausing the upload and resuming after a while.
- **Retry:** Uploads might fail due to temporary network failures. Individual chunks are retried for 5 times with exponential backoff to recover automatically from such failures.
- **Lifecycle Event Listeners:** Listen to various upload lifecycle events to provide real-time feedback to users.
- **Error Handling and Reporting:** Comprehensive error handling to manage upload failures gracefully and inform users of issues.
- **Customizability:** Developers can customize the chunk size and retry attempts based on their specific needs and network conditions.

# Prerequisites:

## Getting started with FastPix:

To get started with SDK, you will need a signed URL.

To make API requests, you'll need a valid **Access Token** and **Secret Key**. See the [Basic Authentication Guide](https://docs.fastpix.io/docs/basic-authentication) for details on retrieving these credentials.

Once you have your credentials, use the [Upload media from device](https://docs.fastpix.io/reference/direct-upload-video-media) API to generate a signed URL for uploading media.

## Installation:

To install the SDK, you can use NPM,  CDN, or your preferred package manager:

### Using NPM:

```bash
npm i @fastpix/resumable-uploads
```

### Using CDN:

```bash
<script src="https://cdn.jsdelivr.net/npm/@fastpix/resumable-uploads@latest/dist/uploads.js"></script>
```

## Basic Usage

## Import

```javascript
import { Uploader } from "@fastpix/resumable-uploads";
```

## Integration

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

## Monitor the upload progress through lifecycle events

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

## Managing Uploads

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

## Parameters Accepted

The upload function accepts the following parameters:

| Name                | Type                                | Required | Description                                                                                                                                                   |
| ------------------- | ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `endpoint`          | `string` or `() => Promise<string>` | Required | The signed URL endpoint where the file will be uploaded. Can be a static string or a function returning a `Promise` that resolves to the upload URL.          |
| `file`              | `File` or `Object`                  | Required | The file object to be uploaded. Typically a `File` retrieved from an `<input type="file" />` element, but can also be a generic object representing the file. |
| `chunkSize`         | `number` (in KB)                    | Optional | Size of each chunk in kilobytes. Default is `16384` KB (16 MB).<br>**Minimum:** 5120 KB (5 MB), **Maximum:** 512000 KB (500 MB).                              |
| `maxFileSize`       | `number` (in KB)                    | Optional | Maximum allowed file size for upload, specified in kilobytes. Files exceeding this limit will be rejected.                                                    |
| `retryChunkAttempt` | `number`                            | Optional | Number of retry attempts per chunk in case of failure. Default is `5`.                                                                                        |
| `delayRetry`        | `number` (in seconds)               | Optional | Delay between retry attempts after a failed chunk upload. Default is `1` second.                                                                              |

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

# References
 
[FastPix Homepage](https://www.fastpix.io/)
[FastPix Dashboard](https://dashboard.fastpix.io/)
[Uploads github](https://github.com/FastPix/web-uploads-sdk)
[API Reference](https://docs.fastpix.io/reference/on-demand-overview)

# Detailed Usage:

For more detailed steps and advanced usage, please refer to the official [FastPix Documentation](https://docs.fastpix.io/docs/upload-videos-directly#resumable-uploading-of-large-files).

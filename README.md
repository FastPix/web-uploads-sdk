# Uploads SDK

This SDK helps you efficiently upload large files from the browser by splitting them into chunks and also gives you the ability to pause and resume your uploads. While the SDK itself is written in TypeScript, we are publishing only the JavaScript output as npm package. Types support for TypeScript users will be released in a later version.

Please note that this SDK is designed to work only with FastPix and is not a general purpose uploads SDK.

## Features:

- **Chunking:** Files are automatically split into chunks (configurable, default size is 16MB/chunk).
- **Pause and Resume:** Allows temporarily pausing the upload and resuming after a while.
- **Retry:** Uploads might fail due to temporary network failures. Individual chunks are retried for 5 times with exponential backoff to recover automatically from such failures.
- **Lifecycle Event Listeners:** Listen to various upload lifecycle events to provide real-time feedback to users.
- **Error Handling and Reporting:** Comprehensive error handling to manage upload failures gracefully and inform users of issues.
- **Customizability:** Developers can customize the chunk size and retry attempts based on their specific needs and network conditions.

## Installation

To install the SDK, you can use npm or your favourite node package manager 😉:

```bash
npm i @fastpix/resumable-uploads
```

## Basic Usage

To get started with SDK, you will need a signed URL. 

To make API requests, you'll need a valid **Access Token** and **Secret Key**. See the [Basic Authentication Guide](https://docs.fastpix.io/docs/basic-authentication) for details on retrieving these credentials.

Once you have your credentials, use the [Upload media from device](https://docs.fastpix.io/reference/direct-upload-video-media) API to generate a signed URL for uploading media.

**Import**

```javascript
import { Uploader } from "@fastpix/resumable-uploads"
```

**Integration**

```javascript
const fileUploader = Uploader.init({
    endpoint: 'https://example.com/signed-url', // Replace with the signed URL.
    file: mediaFile, // Provide the media file you want to upload.
    chunkSize: 5120, // Specify the chunk size in kilobytes (KB). Minimum allowed chunk size is 5120KB (5MB).

    // Additional optional parameters can be specified here as needed
})
```

**Monitor the upload progress through lifecycle events**

```javascript

// Track upload progress
fileUploader.on('progress', event => { 
    console.log("Upload Progress:", event.detail); 
}); 

// Handle errors during the upload process
fileUploader.on('error', event => { 
    console.error("Upload Error:", event.detail.message); 
}); 

// Trigger actions when the upload completes successfully
fileUploader.on('success', event => { 
    console.log("Upload Completed"); 
}); 

// Track the initiation of each chunk upload
fileUploader.on('attempt', event => { 
    console.log("Chunk Upload Attempt:", event.detail); 
}); 

// Track failures of each chunk upload attempt
fileUploader.on('chunkAttemptFailure', event => { 
    console.log("Chunk Attempt Failure:", event.detail); 
}); 

// Perform an action when a chunk is successfully uploaded
fileUploader.on('chunkSuccess', event => { 
    console.log("Chunk Successfully Uploaded:", event.detail); 
}); 

// Triggers when the connection is back online
fileUploader.on('online', event => { 
    console.log("Connection Online"); 
}); 

// Triggers when the connection goes offline
fileUploader.on('offline', event => { 
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

This SDK supports the following parameters:


- `endpoint` (required): 

  The URL endpoint where the file will be uploaded.

- `file` (required): 

  The file object that you want to upload.

- `chunkSize` (optional):

  Size of each chunk in kilobytes (KB). Default is 16 MB (16384 KB), with a minimum of 5 MB (5120 KB) and a maximum of 500 MB (512000 KB).

- `maxFileSize` (optional): 

  The maximum file size allowed for upload, specified in kilobytes (KB). This helps prevent excessively large uploads.

- `retryChunkAttempt` (optional):

  Number of retries per chunk in case of failure. Default is 5 retries.
 
- `delayRetry` (optional):

  Delay between retry attempts (in milliseconds) after a chunk upload fails. Default is 1000 ms.

# Detailed Usage:

For more detailed steps and advanced usage, please refer to the official [FastPix Documentation](https://docs.fastpix.io/docs/upload-videos-directly#resumable-uploading-of-large-files).

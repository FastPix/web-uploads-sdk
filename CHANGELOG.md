# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2]
- Implemented support for Google Cloud Storage resumable uploads and chunked client uploads.
- Added retry mechanism with exponential backoff for GCS upload failures based on retryable status codes.
- Enabled support for user-provided signed URLs, allowing resumable uploads to work with externally generated session URIs.
- Updated the API endpoint from https://v1.fastpix.io/on-demand/uploads to https://api.fastpix.io/v1/on-demand/upload for obtaining signed URLs.

## [1.0.1]
- Update readme.md and license

## [1.0.0]

### Features:

  - **Chunking**: Files are automatically split into chunks (default chunk size is 16MB).
  - **Pause and Resume**: Allows temporarily pausing the upload and resuming after a while.
  - **Retry**:  Uploads might fail due to temporary network failures. Individual chunks are retried for 5 times with exponential backoff to recover automatically from such failures.
  - **Lifecycle Event Listeners**: Provides real-time feedback through various upload lifecycle events.
  - **Error Handling**: Comprehensive error management to notify users of issues during uploads.
  - **Customizability**: Options to customize chunk size and retry attempts.

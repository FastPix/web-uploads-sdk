# Changelog

All notable changes to this project will be documented in this file.

## [1.0.4]

### Notice: FastPix domains migrating from `.io` to `.com`

All FastPix-hosted endpoints (`api.fastpix.io`, `dashboard.fastpix.io`, `docs.fastpix.io`, `www.fastpix.io`) are migrating to the `.com` TLD. The `.io` hosts continue to serve traffic for now and existing integrations will keep working, but they are slated for deprecation — please migrate to `.com`.

This SDK itself does not hard-code any FastPix host (the upload `endpoint` is always supplied by the caller), so no code change in `@fastpix/resumable-uploads` is required. The action item is on the server side: when you mint signed URLs via the [Direct Upload API](https://fastpix.com/docs/api-reference/api-reference/video-on-demand-api/upload-and-import-videos/direct-upload-video-media), call `https://api.fastpix.com/v1/on-demand/upload` instead of `https://api.fastpix.io/v1/on-demand/upload`.

### Docs

- README links updated from `fastpix.io` to `fastpix.com` (homepage, dashboard, docs, API reference). FastPix's `.io` hosts continue to redirect, so existing bookmarks keep working.

### Fixed

- **Pause is now immediate.** `pause()` previously only flipped an internal flag and left the in-flight chunk PUT running to completion, so on large default 16 MB chunks the upload appeared to ignore the first click for many seconds. It now also aborts the active XHR and clears any pending retry timer, so a single click stops uploading right away. `resume()` re-PUTs the same `Content-Range`; GCS resumable semantics make this idempotent and the existing 308 handler reconciles the offset reported by the server.
- **Skip redundant session init for pre-initiated GCS URIs.** When the upload `endpoint` is already a Google Cloud Storage resumable session URI (recognizable by the `upload_id=` query parameter — the shape FastPix's `direct-upload` API now returns), the SDK previously POSTed `x-goog-resumable: start` to it and got back `405 Method Not Allowed`, because session URIs only accept `PUT`. The constructor now detects this case and uses the supplied URL directly as the session URI, going straight to chunk PUTs. Endpoints without `upload_id=` still go through the original POST-to-init flow.

## [1.0.3]
### Changed
- Updated npm authentication from Classic token to Granular token for improved security and fine-grained permissions.

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

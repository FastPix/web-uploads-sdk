# Changelog

All notable changes to this project will be documented in this file.

## [1.0.6]

### Types
- Exported all public type definitions (`UserProps`, `UploadResponse`, `CommonEventData`, and all event-payload interfaces), so consumers can import them directly instead of redeclaring.
- Introduced a strongly-typed `UploaderEventMap` and made `on()` generic, so each event listener now receives a correctly-typed `event.detail` (e.g. a `progress` listener gets `ProgressEventData`) instead of an untyped `CustomEvent`.
- Made the internal `emitEvent()` generic and type-checked against `UploaderEventMap`, removing the previous `Record<string, any>` payload and the `as ...EventData` assertions it required.
- Added explicit return-type annotations across public and internal methods (`abort`, `pause`, `resume`, `requestChunk`, and others).
- Generated and shipped `.d.ts` type declarations: added a `build:types` step and wired the `types`/`exports` fields so TypeScript consumers resolve typings under both ESM and CJS.

### Fixed
- `ErrorEventData` now extends `Partial<CommonEventData>` and carries an optional `detail`, correctly reflecting that some error events — such as session-init failures — are emitted before chunk/common data is available.
- `getCommonEventData()` now falls back `fileSize` to `0` instead of an empty string, keeping the field a `number` as typed.
- Typed streamed chunk parts as `BlobPart[]` to match the `Blob` constructor input.
- **Uploads no longer stay stuck at a stale connection speed.** Browsers can pin a request to the network conditions it was opened under — Firefox in particular applies its throttling per request, so an upload started on a slow network stayed slow even after conditions improved, until the user manually paused and resumed. The SDK now recycles the connection automatically: a chunk request that keeps running past `connectionRefreshInterval` (default 45s) is aborted and re-established on a fresh connection, continuing from the last byte the server committed. The interval backs off up to 8× when a refresh yields no committed progress, so genuinely slow networks are not thrashed. Recycling consumes no retry budget and emits no failure events.
- **Stalled (zero-progress) chunk requests now recover automatically.** Previously a wedged socket that never reached `readyState 4` hung the upload forever with no timeout, error handler, or stall detection — only a manual pause/resume could un-stick it. A stall watchdog now aborts any chunk request with no upload progress for `stallTimeout` (default 30s), routing it into the existing retry/backoff path on a fresh connection.
- **Connection-level retries resume from the server's committed offset.** A retried chunk previously re-sent the entire chunk from its start byte, discarding partial progress. Retries triggered by aborts, stalls, or network failures now query the resumable session (`308` Range check) first and continue from the last committed byte, losing at most the final uncommitted 256 KB block.
- **Retry budget is now per chunk.** `retryChunkAttempt` was counted cumulatively across the whole upload and never reset, so transient retries spread over many chunks could terminally kill a long transfer even though every chunk recovered. The counter now resets on each successful chunk.
- **Resume no longer hangs on a dead status probe.** The `308` byte-offset query used by `resume()` had no timeout; a dead socket there froze resume forever. It is now capped at `stallTimeout`.
- **Fixed an empty-range request when the offset probe reported the upload complete.** When all bytes were already committed, the chunk-index math undercounted a final partial chunk and could issue a PUT for an empty byte range instead of finishing.
- **Resuming while offline no longer dead-locks the upload.** `resume()` was a silent no-op while the network was down (`canResumeUpload()` required connectivity), so the internal pause flag stayed set; on reconnect the `online` handler skips continuation for paused uploads — leaving a user who paused, went offline, pressed resume, and came back online stuck forever. `resume()` now always records the intent (clears the pause flag) and defers the network work to the `online` handler when offline.
- **Pausing while offline is honoured on reconnect.** The mirror case: `pause()` was also dropped while offline (`canProceedWithUpload()` requires connectivity), so on reconnect the engine silently self-resumed an upload the user had paused. `pause()` now records the pause intent regardless of connectivity; the `online` handler already respects it.

### Added
- New optional `stallTimeout` (seconds, default `30`) and `connectionRefreshInterval` (seconds, default `45`) props on `Uploader.init`.

## [1.0.5]

### Security
- Replaced `Math.random()` with `crypto.getRandomValues()` for retry jitter, eliminating predictable timing that could be exploited in timing-based attacks.
- Replaced `isNaN()` with `Number.isNaN()` throughout input validation to prevent silent type-coercion vulnerabilities (e.g., `isNaN("string")` returns `true`, allowing unexpected values through).
- Replaced `parseInt()` with `Number.parseInt()` and an explicit radix to guard against unexpected base-inference behavior during header parsing.
- Tightened chunk-offset and byte-count bounds checks to prevent out-of-range writes when server-reported ranges fall outside the file size.


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
// Supported event types
export type EventNameType =
  | "chunkAttempt"
  | "chunkSuccess"
  | "error"
  | "progress"
  | "success"
  | "online"
  | "offline"
  | "chunkAttemptFailure";

export interface UserProps {
  endpoint: string;
  file: File;
  retryChunkAttempt?: string | number;
  delayRetry?: string | number;
  chunkSize?: string | number;
  maxFileSize?: string | number;
  stallTimeout?: string | number;
  connectionRefreshInterval?: string | number;
}

export interface UploaderEventMap {
  chunkAttempt: CustomEvent<ChunkAttemptEventData>;
  chunkSuccess: CustomEvent<ChunkSuccessEventData>;
  progress: CustomEvent<ProgressEventData>;
  success: CustomEvent<SuccessEventData>;
  error: CustomEvent<ErrorEventData>;
  chunkAttemptFailure: CustomEvent<ChunkAttemptFailureEventData>;
  online: CustomEvent<OnlineEventData>;
  offline: CustomEvent<OfflineEventData>;
}

export interface ChunkAttemptEventData extends CommonEventData {
  chunkNumber: number;
  chunkSize: number | undefined;
}

export interface ProgressEventData extends CommonEventData {
  progress: number;
}

export interface UploadResponse {
  statusCode: number;
  responseBody: any;
  url: string;
  method: string;
  headers: Record<string, string>;
}

export interface CommonEventData {
  totalChunks: number;
  uploadedChunks: number;
  remainingChunks: number;
  totalProgress: number;
  fileName: string;
  fileSize: number;
}

export interface ChunkSuccessEventData extends CommonEventData {
  chunkNumber: number;
  timeInterval: number;
  response: UploadResponse;
}

export interface ErrorEventData extends Partial<CommonEventData> {
  message: string;
  chunkNumber?: number;
  response?: UploadResponse;
  detail?: string;
  statusCode?: number;
  failedAttempts?: number;
  maxAttempts?: number;
}

export interface OnlineEventData extends CommonEventData {
  message: string;
}

export interface OfflineEventData extends CommonEventData {
  message: string;
  uploadOffset: number;
}

export interface ChunkAttemptFailureEventData extends CommonEventData {
  chunkAttempt: number;
  totalChunkFailureAttempts: number;
  chunkNumber: number;
  retryDelay: number;
  isTimeoutOrRateLimit: boolean;
  consecutiveBackoffFailures: number;
}

export interface SuccessEventData extends CommonEventData {
  uploadDuration: number;
  totalDuration: number;
  averageChunkSize: number;
  averageUploadSpeed: number;
}

// Default chunk size of 16MB is considered
const defaultChunkSize: number = 16384;

// Determines the chunk size based on the provided input.
function calculateChunkSize(options: UserProps): number {
  const chunkSize = options.chunkSize
    ? Number(options.chunkSize)
    : defaultChunkSize;
  return chunkSize * 1024;
}

function getRetryJitterMs(): number {
  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  return (randomValues[0] / (0xffffffff + 1)) * 1000;
}

// Handles the processing of video files in chunks
class VideoChunkProcessor {
  private readonly file: File;
  private readonly fileSize: number;

  constructor(file: File) {
    this.file = file;
    this.fileSize = file?.size;
  }

  async getChunk(chunkStart: number, chunkEnd: number): Promise<Blob> {
    // Ensure the chunkEnd is not beyond the file size
    if (chunkEnd > this.fileSize) {
      chunkEnd = this.fileSize;
    }

    try {
      const blob = this.file.slice(chunkStart, chunkEnd);
      const stream = blob.stream();
      const chunks: BlobPart[] = [];
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return new Blob(chunks, { type: this.file.type });
    } catch (error) {
      console.warn(error);
      return this.file.slice(chunkStart, chunkEnd);
    }
  }
}

// Handles the uploading and management of file upload chunks.
export class Uploader {
  private readonly uploadEndpoint: string;
  private readonly sourceFile: File;
  private readonly maxRetryAttempts: number;
  private readonly retryDelaySeconds: number;
  private readonly configuredChunkSize: number;
  private readonly maxFileSizeBytes: number;
  private readonly eventEmitter: EventTarget;
  private readonly chunkProcessor: VideoChunkProcessor | undefined;
  private readonly configuredChunkBytes: number;
  private readonly maxConsecutiveBackoffFailures = 5;
  private sessionUri: string | undefined;
  private retryCount: number;
  private currentChunkIndex: number;
  private isNetworkOffline: boolean;
  private isUploadPaused: boolean;
  private isUploadAborted: boolean;
  private retryTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private currentChunkStartPosition: number;
  private successfulChunksCount: number;
  private currentChunkBytes: number;
  private lastChunkTimestamp: number;
  private totalChunksCount: number;
  private activeRequest: XMLHttpRequest | undefined;
  private uploadStartTimestamp: number;
  private consecutiveBackoffFailures: number = 0;
  private isUploadProgress: boolean;
  private isDestroyed: boolean = false;
  private isSessionInitiating: boolean = false;
  private readonly handleWindowOnline: (() => void) | undefined;
  private readonly handleWindowOffline: (() => void) | undefined;
  private readonly stallTimeoutMs: number;
  private readonly connectionRefreshBaseMs: number;
  private connectionRefreshMs: number;
  private lastUploadProgressAt: number = 0;
  private chunkRequestStartedAt: number = 0;
  private stallWatchdogId: ReturnType<typeof setInterval> | undefined;

  static init(uploadProps: UserProps): Uploader {
    return new Uploader(uploadProps);
  }

  constructor(props: UserProps) {
    this.uploadEndpoint = props.endpoint;
    this.sourceFile = props.file;
    this.maxRetryAttempts = Number(props.retryChunkAttempt) || 5;
    this.retryDelaySeconds = Number(props.delayRetry) || 1;
    this.configuredChunkSize = Number(props.chunkSize);
    this.maxFileSizeBytes = (Number(props.maxFileSize) || 0) * 1024;
    this.stallTimeoutMs = (Number(props.stallTimeout) || 30) * 1000;
    this.connectionRefreshBaseMs =
      (Number(props.connectionRefreshInterval) || 45) * 1000;
    this.connectionRefreshMs = this.connectionRefreshBaseMs;
    this.validateUserInput();

    this.currentChunkIndex = 0;
    this.retryCount = 0;
    this.isNetworkOffline =
      typeof navigator === "undefined" ? false : !navigator.onLine;
    this.isUploadPaused = false;
    this.isUploadAborted = false;
    this.isUploadProgress = false;
    this.retryTimeoutId = undefined;
    this.currentChunkStartPosition = 0;
    this.successfulChunksCount = 0;
    this.currentChunkBytes = 0;
    this.lastChunkTimestamp = 0;
    this.consecutiveBackoffFailures = 0;
    this.uploadStartTimestamp = Date.now();

    this.configuredChunkBytes = calculateChunkSize(props);
    this.eventEmitter = new EventTarget();
    this.totalChunksCount = Math.ceil(
      this.sourceFile.size / this.configuredChunkBytes
    );

    if (props?.file) {
      this.chunkProcessor = new VideoChunkProcessor(props?.file);
    }
    this.scheduleUploadStart();

    if (typeof window !== "undefined") {
      this.handleWindowOnline = () => {
        if (this.isDestroyed || this.isUploadAborted) {
          return;
        }

        if (
          !this.sessionUri &&
          this.uploadEndpoint &&
          this.isNetworkOffline &&
          this.isSessionInitiating
        ) {
          // The initial session request is still pending/interrupted for this instance. Do NOT start a new session here.
          this.isNetworkOffline = false;
          return;
        }

        if (
          this.sessionUri &&
          this.isNetworkOffline &&
          this.retryCount < this.maxRetryAttempts &&
          this.totalChunksCount > 0
        ) {
          this.isNetworkOffline = false;

          if (this.totalChunksCount !== this.successfulChunksCount) {
            this.emitEvent("online", {
              message: "Connection restored. Resuming your upload.",
            } as OnlineEventData);

            if (!this.isUploadPaused) {
              clearTimeout(this.retryTimeoutId);
              this.validateUploadStatus();
            }
          }
        }
      };

      this.handleWindowOffline = () => {
        if (this.isDestroyed || this.isUploadAborted) {
          return;
        }

        this.isNetworkOffline = true;

        if (
          this.totalChunksCount !== this.successfulChunksCount &&
          this.canRetryUpload() &&
          this.totalChunksCount > 0
        ) {
          this.abortActiveXhr();
          this.emitEvent("offline", {
            message:
              "Connection lost. Your upload has been paused. It will automatically resume when the connection is restored.",
          } as OfflineEventData);
        }
      };

      window.addEventListener("online", this.handleWindowOnline);
      window.addEventListener("offline", this.handleWindowOffline);
    }
  }

  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    this.isUploadAborted = true;

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = undefined;
    }
    this.abortActiveXhr();

    if (typeof window !== "undefined") {
      if (this.handleWindowOnline) {
        window.removeEventListener("online", this.handleWindowOnline);
      }
      if (this.handleWindowOffline) {
        window.removeEventListener("offline", this.handleWindowOffline);
      }
    }
  }

  private emitTerminalError(detail: ErrorEventData): void {
    this.emitEvent("error", detail);
    this.destroy();
  }

  private scheduleUploadStart(): void {
    const startUpload = () => {
      if (/[?&]upload_id=/.test(this.uploadEndpoint)) {
        this.sessionUri = this.uploadEndpoint;
        void this.validateUploadStatus();
        return;
      }

      void this.initiateSession();
    };

    if (typeof queueMicrotask === "function") {
      queueMicrotask(startUpload);
      return;
    }

    setTimeout(startUpload, 0);
  }

  async initiateSession(): Promise<void> {
    if (
      this.isDestroyed ||
      this.isUploadAborted ||
      this.sessionUri ||
      this.isSessionInitiating
    ) {
      return;
    }
    this.isSessionInitiating = true;

    try {
      const response = await fetch(this.uploadEndpoint, {
        method: "POST",
        headers: {
          "x-goog-resumable": "start",
          "Content-Type": this.sourceFile?.type ?? "application/octet-stream",
        },
      });

      if (this.isDestroyed || this.isUploadAborted) {
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        this.emitTerminalError({
          message: `Failed to initiate resumable upload session: ${response.status} ${response.statusText || errorText}`,
        });
        return;
      }

      // Get the session URI from the Location header
      const locationHeader = response.headers.get("Location");
      if (!locationHeader) {
        this.emitTerminalError({
          message: "No session URI returned. Please retry upload.",
        });
        return;
      }

      this.sessionUri = locationHeader;
      this.validateUploadStatus();
    } catch (err) {
      const error = err as Error;
      this.emitTerminalError({
        message: "Error while initiating upload session",
        detail: error.message ?? "",
      });
    } finally {
      this.isSessionInitiating = false;
    }
  }

  private abortActiveXhr(): void {
    this.stopStallWatchdog();
    if (this.activeRequest) {
      this.activeRequest.abort();
      this.activeRequest = undefined;
    }
  }

  private startStallWatchdog(xhr: XMLHttpRequest): void {
    this.stopStallWatchdog();
    const now = Date.now();
    this.lastUploadProgressAt = now;
    this.chunkRequestStartedAt = now;
    const tickMs = Math.max(
      250,
      Math.min(
        5000,
        Math.min(this.stallTimeoutMs, this.connectionRefreshMs) / 4
      )
    );

    this.stallWatchdogId = setInterval(() => {
      if (this.activeRequest !== xhr || this.isDestroyed) {
        this.stopStallWatchdog();
        return;
      }

      // Offline and paused states abort the request through their own paths.
      if (this.isUploadPaused || this.isNetworkOffline) {
        return;
      }

      if (Date.now() - this.lastUploadProgressAt >= this.stallTimeoutMs) {
        this.stopStallWatchdog();
        xhr.abort();
        return;
      }

      if (Date.now() - this.chunkRequestStartedAt >= this.connectionRefreshMs) {
        this.stopStallWatchdog();
        void this.recycleConnection(xhr);
      }
    }, tickMs);
  }

  private stopStallWatchdog(): void {
    if (this.stallWatchdogId) {
      clearInterval(this.stallWatchdogId);
      this.stallWatchdogId = undefined;
    }
  }

  private async recycleConnection(xhr: XMLHttpRequest): Promise<void> {
    if (this.activeRequest !== xhr || !this.canProceedWithUpload()) {
      return;
    }

    // Detach handlers first so the abort is not mistaken for a failed chunk.
    xhr.onreadystatechange = null;
    xhr.upload.onprogress = null;
    this.activeRequest = undefined;
    xhr.abort();
    this.isUploadProgress = false;

    const previousPosition = this.currentChunkStartPosition;
    await this.synchronizeUploadPosition();

    if (this.currentChunkStartPosition > previousPosition) {
      this.connectionRefreshMs = Math.max(
        this.connectionRefreshBaseMs,
        this.connectionRefreshMs / 2
      );
    } else {
      this.connectionRefreshMs = Math.min(
        this.connectionRefreshMs * 2,
        this.connectionRefreshBaseMs * 8
      );
    }

    if (
      this.totalChunksCount !== this.successfulChunksCount &&
      !this.isUploadProgress &&
      this.canProceedWithUpload()
    ) {
      this.requestChunk();
    }
  }

  // Method to abort the current chunk being uploaded.
  abort(): void {
    if (this.isDestroyed) {
      return;
    }

    const hadActiveUpload = this.totalChunksCount > 0 && this.activeRequest;

    this.abortActiveXhr();
    this.isUploadAborted = true;
    this.retryUpload();

    if (hadActiveUpload) {
      this.emitEvent("error", {
        ...this.getCommonEventData(),
        message: "Upload aborted. Please try again!",
      });
    }

    this.destroy();
  }

  // Method to pause the upload process
  pause(): void {
    if (
      !this.isDestroyed &&
      !this.isUploadPaused &&
      !this.isUploadAborted &&
      this.totalChunksCount > 0 &&
      this.retryCount < this.maxRetryAttempts
    ) {
      this.isUploadPaused = true;
      this.abortActiveXhr();
    }
  }

  // Method to resume the upload process
  async resume(): Promise<void> {
    if (this.canResumeUpload()) {
      this.isUploadPaused = false;
      if (this.isNetworkOffline) {
        return;
      }
      await this.synchronizeUploadPosition();
      if (
        this.totalChunksCount !== this.successfulChunksCount &&
        !this.isUploadProgress &&
        this.canProceedWithUpload()
      ) {
        this.requestChunk();
      }
    }
  }

  // Method to retry the upload process
  retryUpload(): void {
    this.abortActiveXhr();
    this.resetUploadState();
  }

  // Method to validate user-provided properties
  validateUserInput(): void {
    this.validateUploadEndpoint();
    this.validateSourceFile();
    this.validateRetrySettings();
    this.validateRecoverySettings();
    this.validateChunkSize();
    this.validateMaxFileSize();
  }

  private validateUploadEndpoint() {
    const isValid =
      this.uploadEndpoint &&
      (typeof this.uploadEndpoint === "string" ||
        typeof this.uploadEndpoint === "function");

    if (!isValid) {
      throw new TypeError(
        "Upload endpoint is required. Please provide either a URL string or a function that returns a promise."
      );
    }
  }

  private validateSourceFile() {
    if (!(this.sourceFile instanceof File)) {
      throw new TypeError(
        "Invalid file format. Please provide a valid File object."
      );
    }
  }

  private validateRetrySettings() {
    if (Number.isNaN(this.maxRetryAttempts) || this.maxRetryAttempts < 0) {
      throw new TypeError(
        `Invalid retryChunkAttempt: ${this.maxRetryAttempts}. It must be a non-negative number.`
      );
    }

    if (Number.isNaN(this.retryDelaySeconds) || this.retryDelaySeconds < 0) {
      throw new TypeError(
        `Invalid delayRetry: ${this.retryDelaySeconds}. It must be a non-negative number of seconds.`
      );
    }
  }

  private validateRecoverySettings() {
    if (this.stallTimeoutMs < 1000) {
      throw new TypeError(
        `Invalid stallTimeout: ${this.stallTimeoutMs / 1000}. It must be at least 1 second.`
      );
    }

    if (this.connectionRefreshBaseMs < 5000) {
      throw new TypeError(
        `Invalid connectionRefreshInterval: ${this.connectionRefreshBaseMs / 1000}. It must be at least 5 seconds.`
      );
    }
  }

  private validateChunkSize() {
    const size = this.configuredChunkSize;

    if (!size) return;
    if (Number.isNaN(size)) {
      throw new TypeError("Chunk size must be a valid number.");
    }

    if (size < 5120) {
      throw new TypeError(
        `Chunk size must be at least 5120 KB. Current chunk size: ${size} KB.`
      );
    }

    if (size % 256 !== 0) {
      throw new TypeError(
        `Chunk size must be a multiple of 256 KB. Current chunk size: ${size} KB.`
      );
    }

    if (size > 512000) {
      throw new TypeError(
        `Chunk size cannot exceed 500MB (512000 KB). Current chunk size: ${size} KB.`
      );
    }
  }

  private validateMaxFileSize() {
    const max = this.maxFileSizeBytes;
    const actual = this.sourceFile.size;

    if (Number.isNaN(max)) {
      throw new TypeError("Max file size must be a valid number.");
    }

    if (max < 0) {
      throw new TypeError(
        `Invalid maxFileSize: ${max / 1024} KB. Maximum file size cannot be negative.`
      );
    }

    if (max > 0 && max < actual) {
      const fileSizeMB = (actual / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (max / (1024 * 1024)).toFixed(2);
      throw new Error(
        `File size ${fileSizeMB}MB exceeds the maximum allowed size of ${maxSizeMB}MB. Please choose a smaller file.`
      );
    }
  }

  on<K extends EventNameType>(
    eventName: K,
    fn: (event: UploaderEventMap[K]) => void
  ): void {
    this.eventEmitter.addEventListener(eventName, fn as EventListener);
  }

  private emitEvent<K extends EventNameType>(
    eventName: K,
    detail?: UploaderEventMap[K] extends CustomEvent<infer D> ? D : never
  ): void {
    this.eventEmitter.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  private getCommonEventData(): CommonEventData {
    return {
      totalChunks: this.totalChunksCount,
      uploadedChunks: this.successfulChunksCount,
      remainingChunks: this.totalChunksCount - this.successfulChunksCount,
      totalProgress: (this.successfulChunksCount / this.totalChunksCount) * 100,
      fileName: this.sourceFile.name ?? "",
      fileSize: this.sourceFile.size ?? 0,
    };
  }

  chunkUploadFailureHandler = async (res: UploadResponse): Promise<boolean> => {
    const isRetryable = [408, 429, 500, 502, 503, 504].includes(res.statusCode);
    const hasRetriesLeft = this.retryCount < this.maxRetryAttempts;
    const shouldUploadContinue = this.canProceedWithUpload();

    if (!shouldUploadContinue) {
      return false;
    }

    if (isRetryable && hasRetriesLeft) {
      await this.handleRetryChunkUploading(res);
      return true;
    }

    if (!isRetryable && res.statusCode > 0) {
      this.emitTerminalError({
        ...this.getCommonEventData(),
        message: `Upload failed with server response code ${res.statusCode}. Please check your connection and try again.`,
        chunkNumber: this.currentChunkIndex + 1,
        response: res,
      });
      return false;
    }

    if (res.statusCode <= 0 && hasRetriesLeft) {
      await this.handleRetryChunkUploading(res);
      return true;
    }

    this.emitTerminalError({
      ...this.getCommonEventData(),
      message: `Upload stopped after ${this.retryCount} failed attempts. The server responded with error code ${res.statusCode}. Please try again later.`,
      chunkNumber: this.currentChunkIndex + 1,
      response: res,
    });

    return false;
  };

  private canProceedWithUpload(): boolean {
    return (
      !this.isDestroyed &&
      !this.isNetworkOffline &&
      !this.isUploadPaused &&
      !this.isUploadAborted &&
      this.totalChunksCount > 0
    );
  }

  private canResumeUpload(): boolean {
    return (
      this.isUploadPaused &&
      !this.isUploadAborted &&
      this.retryCount < this.maxRetryAttempts &&
      this.totalChunksCount > 0
    );
  }

  private canRetryUpload(): boolean {
    return (
      !this.isUploadPaused &&
      !this.isUploadAborted &&
      this.retryCount < this.maxRetryAttempts
    );
  }

  private resetUploadState(): void {
    this.currentChunkIndex = 0;
    this.successfulChunksCount = 0;
    this.currentChunkBytes = 0;
    this.lastChunkTimestamp = 0;
    this.consecutiveBackoffFailures = 0;
    this.totalChunksCount = 0;
    this.retryCount = 0;
    this.isNetworkOffline = false;
    this.isUploadPaused = false;
    this.isUploadAborted = true;
    this.retryTimeoutId = undefined;
    this.uploadStartTimestamp = Date.now();
  }

  private calculateProgress(event: ProgressEvent): number {
    const remainingChunks = this.totalChunksCount - this.currentChunkIndex;
    const progressChunkSize =
      this.sourceFile.size - this.currentChunkStartPosition;
    const progressPerChunk =
      progressChunkSize / this.sourceFile.size / remainingChunks;
    const successfulProgress =
      this.currentChunkStartPosition / this.sourceFile.size;
    const checkTotalChunkSize = event.total ?? this.configuredChunkBytes;
    const currentChunkProgress = event.loaded / checkTotalChunkSize;
    const chunkProgress = currentChunkProgress * progressPerChunk;
    const uploadProgress = Math.min(
      (successfulProgress + chunkProgress) * 100,
      100
    );

    return uploadProgress;
  }

  private parseResponseHeaders(headers: string): Record<string, string> {
    const headerMap: Record<string, string> = {};
    headers
      .trim()
      .split(/[\r\n]+/)
      .forEach((line) => {
        const parts = line.split(": ");
        const header = parts.shift();
        const value = parts.join(": ");
        if (header) {
          headerMap[header.toLowerCase()] = value;
        }
      });
    return headerMap;
  }

  private handleChunkSuccess(uploadResponse: UploadResponse): void {
    this.currentChunkIndex++;
    this.successfulChunksCount += 1;
    this.consecutiveBackoffFailures = 0;
    this.retryCount = 0;
    this.connectionRefreshMs = Math.max(
      this.connectionRefreshBaseMs,
      this.connectionRefreshMs / 2
    );
    const prevChunkUploadedTime = new Date();
    const prevChunkUploadedInterval =
      (prevChunkUploadedTime.getTime() - this.lastChunkTimestamp) / 1000;

    this.emitEvent("chunkSuccess", {
      ...this.getCommonEventData(),
      chunkNumber: this.currentChunkIndex,
      timeInterval: prevChunkUploadedInterval,
      response: uploadResponse,
    });

    this.currentChunkStartPosition =
      this.currentChunkStartPosition + this.currentChunkBytes;
    this.validateUploadStatus();
  }

  private handleResumeUpload(
    uploadedBytes: number,
    prevChunkRangeEnd: number,
    uploadResponse: UploadResponse
  ): void {
    if (uploadedBytes < prevChunkRangeEnd) {
      this.updateUploadPosition(uploadedBytes + 1);
      this.handleRetryChunkUploading(uploadResponse);
    } else {
      this.handleChunkSuccess(uploadResponse);
    }
  }

  private updateUploadPosition(nextBytePosition: number): void {
    const boundedPosition = Math.min(nextBytePosition, this.sourceFile.size);
    this.currentChunkStartPosition = boundedPosition;
    if (boundedPosition >= this.sourceFile.size) {
      this.currentChunkIndex = this.totalChunksCount;
      this.successfulChunksCount = this.totalChunksCount;
    } else {
      this.currentChunkIndex = Math.floor(
        boundedPosition / this.configuredChunkBytes
      );
      this.successfulChunksCount = Math.min(
        this.currentChunkIndex,
        this.totalChunksCount
      );
    }
    this.currentChunkBytes = 0;
  }

  private queryCommittedByteCount(): Promise<number | undefined> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      this.activeRequest = xhr;
      const uploadUrl = this.sessionUri ?? this.uploadEndpoint;

      xhr.open("PUT", uploadUrl, true);
      xhr.timeout = this.stallTimeoutMs;
      xhr.ontimeout = () => {
        this.activeRequest = undefined;
        resolve(undefined);
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          this.activeRequest = undefined;
          const headerMap = this.parseResponseHeaders(
            xhr.getAllResponseHeaders()
          );

          if ([200, 201, 204].includes(xhr.status)) {
            resolve(this.sourceFile.size);
            return;
          }

          if (xhr.status === 308) {
            const rangeHeader = headerMap["range"];
            if (rangeHeader) {
              const rangeMatch = /bytes=0-(\d+)/.exec(rangeHeader);
              if (rangeMatch) {
                resolve(Number.parseInt(rangeMatch[1], 10) + 1);
                return;
              }
            }

            resolve(0);
            return;
          }

          resolve(undefined);
        }
      };

      xhr.setRequestHeader("x-goog-resumable", "start");
      xhr.setRequestHeader("Content-Range", `bytes */${this.sourceFile.size}`);
      xhr.send();
    });
  }

  private async synchronizeUploadPosition(): Promise<void> {
    if (!this.sessionUri && !this.uploadEndpoint) {
      return;
    }

    const committedByteCount = await this.queryCommittedByteCount();
    if (committedByteCount === undefined) {
      return;
    }

    this.updateUploadPosition(committedByteCount);
    if (committedByteCount >= this.sourceFile.size) {
      this.validateUploadStatus();
    }
  }

  private submitHttpRequest(options: {
    method: "PUT";
    url: string;
    body: Blob | File;
  }): Promise<UploadResponse> {
    return new Promise((resolve) => {
      let xhr = new XMLHttpRequest();
      this.activeRequest = xhr;
      const sourceType = this.sourceFile.type
        ? this.sourceFile.type
        : "application/octet-stream";
      const chunkRangeStart = this.currentChunkStartPosition;
      const chunkRangeEnd =
        this.currentChunkStartPosition + this.currentChunkBytes - 1;

      if (this.retryTimeoutId) {
        clearTimeout(this.retryTimeoutId);
      }

      xhr.open(options.method, options.url, true);

      xhr.upload.onprogress = (event: ProgressEvent) => {
        this.isUploadProgress = true;
        this.lastUploadProgressAt = Date.now();
        const progress = this.calculateProgress(event);
        this.emitEvent("progress", {
          ...this.getCommonEventData(),
          progress: progress,
        });
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          this.isUploadProgress = false;
          if (this.activeRequest === xhr) {
            this.stopStallWatchdog();
          }
          const headerMap = this.parseResponseHeaders(
            xhr.getAllResponseHeaders()
          );
          const uploadResponse: UploadResponse = {
            statusCode: xhr.status,
            responseBody: xhr.response,
            url: options.url,
            method: "PUT",
            headers: headerMap,
          };

          if (xhr.status === 308) {
            const rangeHeader = headerMap["range"];
            if (rangeHeader) {
              const rangeMatch = /bytes=0-(\d+)/.exec(rangeHeader);
              if (rangeMatch) {
                const uploadedBytes = Number.parseInt(rangeMatch[1], 10);
                this.handleResumeUpload(
                  uploadedBytes,
                  chunkRangeEnd,
                  uploadResponse
                );
                resolve(uploadResponse);
                return;
              }
            }
            this.handleChunkSuccess(uploadResponse);
            resolve(uploadResponse);
            return;
          } else if ([200, 201, 204, 206].includes(xhr.status)) {
            this.handleChunkSuccess(uploadResponse);
          } else {
            this.chunkUploadFailureHandler(uploadResponse);
          }

          resolve(uploadResponse);
        }
      };

      xhr.setRequestHeader("Content-Type", sourceType);
      xhr.setRequestHeader(
        "Content-Range",
        `bytes ${chunkRangeStart}-${chunkRangeEnd}/${this.sourceFile.size}`
      );
      this.startStallWatchdog(xhr);
      xhr.send(options.body);
    });
  }

  async handleRetryChunkUploading(res: UploadResponse): Promise<void> {
    if (this.canRetryUpload() && !this.isNetworkOffline && navigator.onLine) {
      const requiresBackoff =
        res && [408, 429, 500, 502, 503, 504].includes(res.statusCode);

      if (requiresBackoff) {
        this.consecutiveBackoffFailures++;

        if (
          this.consecutiveBackoffFailures >= this.maxConsecutiveBackoffFailures
        ) {
          this.emitTerminalError({
            ...this.getCommonEventData(),
            message: `Upload stopped after ${this.consecutiveBackoffFailures} consecutive failures. Please try again later.`,
            chunkNumber: this.currentChunkIndex + 1,
            response: res,
          });
          return;
        }
      } else {
        this.consecutiveBackoffFailures = 0;
      }

      let delay: number;
      if (requiresBackoff) {
        const baseDelay = 2000;
        delay = Math.min(
          baseDelay * Math.pow(2, this.retryCount) + getRetryJitterMs(),
          5000
        );
      } else {
        delay = this.retryDelaySeconds * 1000;
      }

      this.retryTimeoutId = setTimeout(async () => {
        if (this.canRetryUpload() && !this.isNetworkOffline) {
          if (!requiresBackoff || res.statusCode === 308) {
            this.retryCount++;
          }

          this.emitEvent("chunkAttemptFailure", {
            ...this.getCommonEventData(),
            chunkAttempt: this.retryCount,
            totalChunkFailureAttempts: this.maxRetryAttempts,
            chunkNumber: this.currentChunkIndex + 1,
          } as ChunkAttemptFailureEventData);

          // A connection-level failure (abort/stall/network: status <= 0) may
          // still have committed part of the chunk server-side; resync so the
          // retry continues from the last committed byte instead of
          // re-sending the whole chunk.
          if (res.statusCode <= 0) {
            await this.synchronizeUploadPosition();
            if (
              this.totalChunksCount > 0 &&
              this.totalChunksCount === this.successfulChunksCount
            ) {
              return;
            }
          }

          this.requestChunk();
        }
      }, delay);
    }
  }

  // Method to validate the upload status and proceed accordingly
  async validateUploadStatus(): Promise<void> {
    if (this.isDestroyed || this.isUploadAborted) {
      return;
    }

    if (this.totalChunksCount <= 0) {
      return;
    }

    if (this.totalChunksCount === this.successfulChunksCount) {
      const totalDuration = (Date.now() - this.uploadStartTimestamp) / 1000; // Convert to seconds
      this.emitEvent("success", {
        ...this.getCommonEventData(),
        uploadDuration: (Date.now() - this.lastChunkTimestamp) / 1000,
        totalDuration: totalDuration,
      } as SuccessEventData);
    } else {
      this.requestChunk();
    }
  }

  // Method to initiate chunk uploads
  async requestChunk(): Promise<void> {
    if (this.canProceedWithUpload() && navigator.onLine) {
      try {
        let currentChunk: Blob | undefined;

        if (this.chunkProcessor) {
          const chunkEnd =
            this.currentChunkStartPosition + this.configuredChunkBytes;
          currentChunk = await this.chunkProcessor.getChunk(
            this.currentChunkStartPosition,
            chunkEnd
          );
        }

        if (!this.canProceedWithUpload()) {
          return;
        }

        if (currentChunk) {
          if (currentChunk?.size) {
            this.currentChunkBytes = currentChunk?.size;
          }

          this.emitEvent("chunkAttempt", {
            ...this.getCommonEventData(),
            chunkNumber: this.currentChunkIndex + 1,
            chunkSize: currentChunk?.size,
          });
          this.lastChunkTimestamp = Date.now();
          this.submitHttpRequest({
            method: "PUT",
            url: this.sessionUri ?? this.uploadEndpoint,
            body: currentChunk,
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error(err);
        this.emitTerminalError({
          message:
            "An error occurred while preparing the chunk for upload. Please try again.",
        });
      }
    }
  }
}

if (typeof window !== "undefined") {
  (window as any).Uploader = Uploader;
}

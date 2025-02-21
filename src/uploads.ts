// Suported event types
type EventNameType =
  | "chunkAttempt"
  | "chunkSuccess"
  | "error"
  | "progress"
  | "success"
  | "online"
  | "offline"
  | "chunkAttemptFailure";

interface UserProps {
  endpoint: string;
  file: File;
  retryChunkAttempt?: string | number;
  delayRetry?: string | number;
  chunkSize?: string | number;
  maxFileSize?: string | number;
  initUploadUrl?: string;
  completeUploadUrl?: string;
}

// Default chunk size of 16MB is considered
const defaultChunkSize: number = 16384;

// Determines the chunk size based on the provided input.
function calculateChunkSize(options: UserProps) {
  const chunkSize = options.chunkSize
    ? Number(options.chunkSize)
    : defaultChunkSize;
  return chunkSize * 1024;
}

// Handles the processing of video files in chunks
class VideoChunkProcessor {
  file: File;
  fileSize: number;

  constructor(file: File) {
    this.file = file;
    this.fileSize = file?.size;
  }

  getChunk(chunkStart: number, chunkEnd: number): Blob {
    // Ensure the chunkEnd is not beyond the file size
    if (chunkEnd > this.fileSize) {
      chunkEnd = this.fileSize;
    }

    // Return the sliced chunk (blob)
    return this.file.slice(chunkStart, chunkEnd);
  }
}

// Makes a POST request to the specified URL with the provided payload.
async function sendPostRequest(
  url: string,
  uploadBody: {
    signedUrl?: string;
    uploadId?: string;
    action: string;
    partitions?: number;
    objectName?: string;
  }
) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(uploadBody),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      const errorData = await response.json();

      return {
        error: {
          code: response.status,
          message:
            errorData?.error?.message ||
            "Something went wrong. Please retry uploading",
        },
      };
    }
  } catch (error) {
    return {
      error: {
        code: 500,
        message: "An internal error occurred. Please try again later.",
      },
    };
  }
}

// Handles the uploading and management of file upload chunks.
export class Uploader {
  endpoint: string;
  streamFile: File;
  failedChunkRetries: number;
  retryChunkAttempt: number;
  delayRetry: number;
  customizedChunkSize: number;
  maxFileBytes: number;
  initUploadApi: string | undefined;
  completeUploadApi: string | undefined;
  chunkOffset: number;
  isOffline: boolean;
  isPaused: boolean;
  isAborted: boolean;
  delayUploadTimeout: number | undefined;
  isUploadCompleted: boolean;
  nextChunkRangeStart: number;
  successiveChunkCount: number;
  currentChunkSize: number;
  prevSegmentStart: number | any;
  chunkSize: number;
  eventDispatcher: EventTarget;
  totalChunks: number;
  resObject: {
    uploadId: string;
    uploadSignedUrl: string[];
    uploadObjectName: string;
  };
  videoChunkProcessor: VideoChunkProcessor | undefined;
  getSignedUrl: Promise<void>;
  activeXhr: XMLHttpRequest | undefined;

  static init(uploadProp: UserProps) {
    return new Uploader(uploadProp);
  }

  constructor(props: UserProps) {
    this.endpoint = props.endpoint;
    this.streamFile = props.file;
    this.failedChunkRetries = 0;
    this.retryChunkAttempt = Number(props.retryChunkAttempt) || 5;
    this.delayRetry = Number(props.delayRetry) || 1;
    this.customizedChunkSize = Number(props.chunkSize);
    this.maxFileBytes = (Number(props.maxFileSize) || 0) * 1024;
    this.initUploadApi = props.initUploadUrl;
    this.completeUploadApi = props.completeUploadUrl;
    this.chunkOffset = 0;
    this.isOffline = false;
    this.isPaused = false;
    this.isAborted = false;
    this.delayUploadTimeout = undefined;
    this.isUploadCompleted = false;
    this.nextChunkRangeStart = 0;
    this.successiveChunkCount = 0;
    this.currentChunkSize = 0;
    this.prevSegmentStart = 0;
    this.chunkSize = calculateChunkSize(props);
    this.eventDispatcher = new EventTarget();
    this.totalChunks = Math.ceil(this.streamFile.size / this.chunkSize); // Calculating the total number of chunks based on file size and chunk size
    this.resObject = {
      uploadId: "",
      uploadSignedUrl: [],
      uploadObjectName: "",
    };

    if (props?.file) {
      this.videoChunkProcessor = new VideoChunkProcessor(props?.file);
    }

    // Validating user passed parameters
    this.validateUserInput();
    this.getSignedUrl = this.initMultipleUploadRequest();

    // Adding event listeners for online/offline status
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        if (
          this.isOffline &&
          this.failedChunkRetries < this.retryChunkAttempt &&
          !this.isAborted &&
          this.totalChunks > 0 &&
          this.resObject.uploadSignedUrl?.length > 0
        ) {
          this.isOffline = false;

          if (!this.isUploadCompleted) {
            this.emitEvent("online");

            if (!this.isPaused) {
              clearTimeout(this.delayUploadTimeout);
              this.validateUploadStatus();
            }
          }
        } else {
          return;
        }
      });

      window.addEventListener("offline", () => {
        this.isOffline = true;

        if (
          this.totalChunks !== this.successiveChunkCount &&
          !this.isUploadCompleted &&
          !this.isAborted &&
          this.failedChunkRetries < this.retryChunkAttempt &&
          this.totalChunks > 0 &&
          this.resObject.uploadSignedUrl?.length > 0
        ) {
          if (this.activeXhr) {
            this.activeXhr?.abort();
            this.activeXhr = undefined;
          }
          this.emitEvent("offline", {
            message: "Upload paused. Resuming when connection is restored.",
          });
        }
      });
    }
  }

  // Method to abort the current chunk being uploaded
  abort() {
    if (
      this.activeXhr &&
      this.totalChunks > 0 &&
      this.resObject.uploadSignedUrl?.length > 0
    ) {
      this.activeXhr?.abort();
      this.activeXhr = undefined;
      this.isAborted = true;
      this.retryUpload();
      this.emitEvent("error", {
        message: "Upload aborted. Please try again!",
      });
    }
  }

  // Method to pause the upload process
  pause() {
    if (
      !this.isOffline &&
      !this.isPaused &&
      !this.isAborted &&
      this.failedChunkRetries < this.retryChunkAttempt &&
      this.totalChunks > 0 &&
      this.resObject.uploadSignedUrl?.length > 0
    ) {
      this.isPaused = true;
      if (this.activeXhr) {
        this.activeXhr?.abort();
        this.activeXhr = undefined;
      }
    }
  }

  // Method to resume the upload process
  resume() {
    if (
      this.isPaused &&
      !this.isOffline &&
      !this.isAborted &&
      this.failedChunkRetries < this.retryChunkAttempt &&
      this.totalChunks > 0 &&
      this.resObject.uploadSignedUrl?.length > 0
    ) {
      this.isPaused = false;
      if (this.totalChunks !== this.successiveChunkCount) {
        this.requestChunk();
      }
    }
  }

  // Method to retry the upload process
  retryUpload() {
    if (this.activeXhr) {
      this.activeXhr?.abort();
      this.activeXhr = undefined;
    }

    if (this.resObject) {
      this.resObject = {
        uploadId: "",
        uploadSignedUrl: [],
        uploadObjectName: "",
      };
    }

    this.chunkOffset = 0;
    this.successiveChunkCount = 0;
    this.currentChunkSize = 0;
    this.prevSegmentStart = 0;
    this.totalChunks = 0;
    this.failedChunkRetries = 0;
    this.isOffline = false;
    this.isPaused = false;
    this.isAborted = true;
    this.isUploadCompleted = false;
    this.failedChunkRetries = 0;
    this.delayUploadTimeout = undefined;
  }

  // Method to validate user-provided properties
  validateUserInput() {
    if (
      !this.endpoint ||
      (typeof this.endpoint !== "function" && typeof this.endpoint !== "string")
    ) {
      throw new TypeError(
        "The endpoint must be provided either as a string or a function that returns a promise."
      );
    }

    if (!(this.streamFile instanceof File)) {
      throw new TypeError("The file must be an object of type File");
    }

    if (this.customizedChunkSize < 5120) {
      throw new TypeError("The chunk-size must be 5120 KB or more");
    }

    if (this.customizedChunkSize > 512000) {
      throw new TypeError("The chunk-size shouldn't be greater than 512000 KB");
    }

    if (this.maxFileBytes > 0 && this.maxFileBytes < this.streamFile.size) {
      throw new Error(
        `The uploaded file size of ${this.streamFile.size} KB exceeds the permitted file size of ${this.maxFileBytes} KB`
      );
    }
  }

  on(eventName: EventNameType, fn: (event: CustomEvent) => void) {
    this.eventDispatcher.addEventListener(eventName, fn as EventListener);
  }

  // Dispatching events
  emitEvent(eventName: EventNameType, detail?: Object) {
    this.eventDispatcher.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  // Method to handle failures during chunk upload
  chunkUploadFailureHandler = async (res: {
    statusCode: number;
    responseBody: any;
    url: string;
    method: string;
  }) => {
    if (
      !this.isOffline &&
      !this.isPaused &&
      !this.isAborted &&
      this.totalChunks > 0 &&
      this.resObject.uploadSignedUrl?.length > 0
    ) {
      if (res.statusCode > 0) {
        this.emitEvent("error", {
          message: `Stopping upload due to server responded with ${res.statusCode}.`,
          chunk: this.chunkOffset,
          response: res,
        });
      } else {
        if (this.failedChunkRetries < this.retryChunkAttempt) {
          await this.handleRetryChunkUploading();
        } else {
          this.emitEvent("error", {
            message: `Stopping upload after ${this.failedChunkRetries} attempts, because server responded with error code ${res.statusCode}.`,
            chunk: this.chunkOffset,
            response: res,
          });
        }
      }
    }

    return false;
  };

  // Method to make an HTTP request for chunk upload
  submitHttpRequest(options: {
    method: "PUT";
    url: string;
    body: Blob | File;
  }) {
    return new Promise((resolve) => {
      let xhr = new XMLHttpRequest();
      this.activeXhr = xhr;

      if (this.delayUploadTimeout) {
        clearTimeout(this.delayUploadTimeout);
      }

      xhr.open(options.method, options.url, true);

      xhr.upload.onprogress = (event) => {
        const remainingChunks = this.totalChunks - this.chunkOffset;
        const progressChunkSize =
          this.streamFile.size - this.nextChunkRangeStart;
        const progressPerChunk =
          progressChunkSize / this.streamFile.size / remainingChunks;
        const successfulProgress =
          this.nextChunkRangeStart / this.streamFile.size;
        const checkTotalChunkSize = event.total ?? this.chunkSize;
        const currentChunkProgress = event.loaded / checkTotalChunkSize;
        const chunkProgress = currentChunkProgress * progressPerChunk;
        const overallProgress = Math.min(
          (successfulProgress + chunkProgress) * 100,
          100
        );
        this.emitEvent("progress", overallProgress);
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          const uploadResponse = {
            statusCode: xhr.status,
            responseBody: xhr.response,
            url: options.url,
            method: "PUT",
          };

          if ([200, 201, 204, 206].includes(xhr.status)) {
            this.chunkOffset++;
            this.successiveChunkCount += 1;
            const prevChunkUploadedTime = new Date();
            let prevChunkUploadedInterval =
              (prevChunkUploadedTime.getTime() -
                this.prevSegmentStart.getTime()) /
              1000;

            this.emitEvent("chunkSuccess", {
              chunk: this.chunkOffset,
              chunkSize: this.currentChunkSize,
              timeInterval: prevChunkUploadedInterval,
              response: uploadResponse,
            });

            this.nextChunkRangeStart =
              this.nextChunkRangeStart + this.currentChunkSize;
            this.validateUploadStatus();
          } else {
            this.chunkUploadFailureHandler(uploadResponse);
          }

          resolve(uploadResponse);

          return uploadResponse;
        }
      };

      xhr.setRequestHeader("Content-Type", "multipart/form-data");
      xhr.send(options.body);
    });
  }

  async handleRetryChunkUploading() {
    if (!this.isOffline && !this.isPaused && !this.isAborted) {
      if (navigator.onLine) {
        if (this.failedChunkRetries < this.retryChunkAttempt) {
          this.delayUploadTimeout = setTimeout(() => {
            if (!this.isOffline && !this.isPaused && !this.isAborted) {
              this.failedChunkRetries++;
              this.emitEvent("chunkAttemptFailure", {
                chunkAttempt: this.failedChunkRetries,
                totalChunkFailureAttempts: this.retryChunkAttempt,
                chunkNumber: this.chunkOffset + 1,
                totalChunks: this.totalChunks,
              });
              this.requestChunk();
            }
          }, this.delayRetry * 1000);
        }
      }
    }
  }

  // Method to validate the upload status and proceed accordingly
  async validateUploadStatus() {
    if (this.totalChunks === this.successiveChunkCount) {
      if (this.totalChunks > 1) {
        this.completeUpload();
      } else {
        this.emitEvent("success");
      }
    } else {
      this.requestChunk();
    }
  }

  // Method to initiate chunk uploads
  requestChunk() {
    if (
      this.resObject.uploadSignedUrl?.length === this.totalChunks &&
      this.totalChunks > 0 &&
      this.resObject.uploadSignedUrl?.length > 0 &&
      !this.isOffline &&
      !this.isPaused &&
      !this.isAborted &&
      navigator.onLine
    ) {
      let currentChunk: Blob | undefined;

      if (this.videoChunkProcessor) {
        if (this.chunkOffset === 0) {
          currentChunk = this.videoChunkProcessor.getChunk(0, this.chunkSize);
        } else {
          currentChunk = this.videoChunkProcessor.getChunk(
            this.nextChunkRangeStart,
            this.chunkSize * (this.chunkOffset + 1)
          );
        }
      }

      if (currentChunk) {
        if (currentChunk?.size) {
          this.currentChunkSize = currentChunk?.size;
        }

        this.emitEvent("chunkAttempt", {
          chunkNumber: this.chunkOffset + 1,
          totalChunks: this.totalChunks,
          chunkSize: currentChunk?.size,
        });
        this.prevSegmentStart = new Date();
        this.submitHttpRequest({
          method: "PUT",
          url: this.resObject.uploadSignedUrl![this.chunkOffset],
          body: currentChunk,
        });
      }
    }
  }

  // Method to initialize the multiple upload request
  async initMultipleUploadRequest() {
    let uploadUrl = this.initUploadApi
      ? this.initUploadApi
      : "https://v1.fastpix.io/on-demand/uploads/multipart";

    let uploadBody: {
      signedUrl: string;
      partitions: number;
      action: string;
    } = {
      action: "init",
      signedUrl: this.endpoint,
      partitions: this.totalChunks,
    };

    try {
      let uploadResponse = await sendPostRequest(uploadUrl, uploadBody);

      if (uploadResponse?.success) {
        this.resObject.uploadId = uploadResponse?.data?.uploadId;
        this.resObject.uploadSignedUrl = uploadResponse?.data?.uploadUrls;
        this.resObject.uploadObjectName = uploadResponse?.data?.objectName;
        this.requestChunk();
      } else {
        if (!this.isOffline) {
          const errorMessage = `When requesting multiple uploads, the server responded with error code ${uploadResponse?.error.code}${uploadResponse?.error.message ? " - " + uploadResponse?.error?.message : ""}.`;
          this.emitEvent("error", {
            message: errorMessage,
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Method to complete the upload process
  async completeUpload() {
    let completeReqUrl = this.completeUploadApi
      ? this.completeUploadApi
      : "https://v1.fastpix.io/on-demand/uploads/multipart";

    let uploadBody: {
      objectName: string;
      uploadId: string;
      action: string;
    } = {
      action: "complete",
      uploadId: this.resObject.uploadId,
      objectName: this.resObject.uploadObjectName,
    };

    try {
      if (!this.isUploadCompleted) {
        let completeUploading = await sendPostRequest(
          completeReqUrl,
          uploadBody
        );

        if (completeUploading?.success) {
          this.emitEvent("success");
          this.retryUpload();
          this.isUploadCompleted = true;
        } else {
          this.isUploadCompleted = false;
          const errorMessage = `Upload completion resulted in an error from the server: ${completeUploading.error.code}${completeUploading.error.message ? " - " + completeUploading.error.message : ""}.`;
          this.emitEvent("error", {
            message: errorMessage,
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}

if (typeof window !== "undefined") {
  (window as any).Uploader = Uploader;
}

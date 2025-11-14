---
name: Bug Report
about: Report a bug or unexpected behavior in the FastPix Resumable Uploads SDK
title: '[BUG] '
labels: ['bug', 'needs-triage']
assignees: ''
---

# Bug Report

Thank you for taking the time to report a bug with the FastPix Resumable Uploads SDK. To help us resolve your issue quickly and efficiently, please provide the following information:

## Description
**Clear and concise description of the bug:**

<!-- Please provide a detailed description of what you're experiencing -->

## Environment Information

### System Details
- **Browser:** [e.g., Chrome, Firefox, Safari, Edge]
- **Browser Version:** [e.g., 120.0.6099.109, 121.0, 17.0]
- **Operating System:** [e.g., Windows 10, macOS 12.0, Ubuntu 20.04, etc.] (Optional but helpful)

### SDK Information
- **FastPix Resumable Uploads SDK Version:** [e.g., 1.0.3, 1.0.2, etc.]
- **TypeScript Version:** [e.g., 5.1.6, 4.9.5, etc.] (if applicable)
- **Framework:** [e.g., React, Vue, Angular, Vanilla JS, etc.] (if applicable)

## Reproduction Steps

1. **Setup Environment:**
   ```bash
   npm install @fastpix/resumable-uploads@latest
   ```

2. **Code to Reproduce:**
   ```javascript
   // Please provide a minimal, reproducible example
   import { Uploader } from "@fastpix/resumable-uploads";
   
   const fileUploader = Uploader.init({
     endpoint: "https://example.com/signed-url",
     file: mediaFile, // From <input type="file" />
     chunkSize: 5 * 1024, // 5MB (5120 KB) - chunk size is in KB
   });
   
   fileUploader.on("progress", (event) => {
     console.log("Progress:", event.detail.progress);
   });
   
   // Your code here that causes the issue
   ```

3. **Expected Behavior:**

    ```
    <!-- Describe what you expected to happen -->
    ```

4. **Actual Behavior:**

    ```
    <!-- Describe what actually happened -->
    ```

5. **Error Messages/Logs:**
   ```
   <!-- Paste any error messages, stack traces, or logs here -->
   ```

## Debugging Information

### Console Output
```
<!-- Paste the complete console output here -->
```

### Error Stack Traces
```javascript
// Complete stack trace for JavaScript/TypeScript errors
Error: Upload failed: Network timeout
    at Uploader.uploadChunk (uploads.js:123:45)
    at async processChunk (chunk-manager.js:45:12)
    at async fileUploader.onProgress (progress-handler.js:23:8)
```

### Network Requests
```http
# Raw HTTP request (remove sensitive headers and signed URL)
PUT /upload-path HTTP/1.1
Host: [FastPix upload endpoint]
Content-Type: application/octet-stream
Content-Length: ***

<!-- Remove signed URL and sensitive headers before pasting -->
```

### Screenshots
<!-- If applicable, please attach screenshots that help explain your issue -->

## Additional Context

### Configuration
```javascript
// Please share your SDK configuration (remove sensitive information)
const fileUploader = Uploader.init({
  endpoint: "***", // Your signed URL (redacted)
  file: mediaFile,
  chunkSize: 5 * 1024, // Your chunk size in KB
  retryChunkAttempt: 5,
  delayRetry: 1,
  maxFileSize: 100 * 1024,
  // Any other configuration options
});
```

### Workarounds
<!-- If you've found any workarounds, please describe them here -->

## Priority
Please indicate the priority of this bug:

- [ ] Critical (Blocks production use)
- [ ] High (Significant impact on functionality)
- [ ] Medium (Minor impact)
- [ ] Low (Nice to have)

## Checklist
Before submitting, please ensure:

- [ ] I have searched existing issues to avoid duplicates
- [ ] I have provided all required information
- [ ] I have tested with the latest SDK version
- [ ] I have removed any sensitive information (signed URLs, file paths, etc.)
- [ ] I have provided a minimal reproduction case
- [ ] I have checked the documentation

---

**Thank you for helping improve the FastPix Resumable Uploads SDK! 🚀**


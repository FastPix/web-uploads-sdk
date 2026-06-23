---
name: Question/Support
about: Ask questions or get help with the FastPix Resumable Uploads SDK
title: '[QUESTION] '
labels: ['question', 'needs-triage']
assignees: ''
---

# Question/Support

Thank you for reaching out! We're here to help you with the FastPix Resumable Uploads SDK. Please provide the following information:

## Question Type
- [ ] How to use a specific feature
- [ ] Integration help
- [ ] Configuration question
- [ ] Performance question
- [ ] Troubleshooting help
- [ ] Pause/Resume functionality
- [ ] Chunk size optimization
- [ ] Other: _______________

## Question
**What would you like to know?**
```
<!-- Please provide a clear, specific question -->
```
## What You've Tried
**What have you already attempted to solve this?**

```javascript
// Please share any code you've tried (browser-based)
import { Uploader } from "@fastpix/resumable-uploads";

// Your attempted code here
```

## Current Setup
**Describe your current setup:**

### Environment
- **Browser:** [e.g., Chrome, Firefox, Safari, Edge]
- **Browser Version:** [e.g., 120.0.6099.109, 121.0, 17.0]
- **Operating System:** [e.g., Windows 10, macOS 12.0, Ubuntu 20.04, etc.] (Optional but helpful)
- **FastPix Resumable Uploads SDK Version:** [e.g., 1.0.3, 1.0.2]
- **Framework:** [e.g., React, Vue, Angular, Vanilla JS, etc.] (if applicable)

### Configuration
```javascript
// Your current SDK configuration (remove sensitive information)
import { Uploader } from "@fastpix/resumable-uploads";

const fileUploader = Uploader.init({
  endpoint: "***", // Your signed URL (remove if sensitive)
  file: mediaFile,
  chunkSize: 5 * 1024, // Your chunk size in KB (5120 KB = 5 MB)
  retryChunkAttempt: 5, // Number of retry attempts per chunk
  delayRetry: 1, // Delay between retries in seconds
  maxFileSize: 100 * 1024, // Maximum file size in KB (optional)
  // Any other configuration
});

// Your event listeners
fileUploader.on("progress", (event) => {
  // Your code
});
```

## Expected Outcome
**What are you trying to achieve?**
```
<!-- Describe your end goal -->
```
## Error Messages (if any)
```
<!-- If you're getting errors, paste them here -->
```

## Additional Context

### Use Case
**What are you building?**

- [ ] Web application
- [ ] Mobile app (web-based)
- [ ] File upload service
- [ ] Media upload platform
- [ ] Other: _______________

### File Details
- **File Type:** [e.g., video/mp4, image/jpeg, etc.]
- **Typical File Size:** [e.g., 10MB, 100MB, 1GB, etc.]
- **Network Type:** [e.g., WiFi, 4G, 5G, Ethernet]

### Timeline
**When do you need this resolved?**

- [ ] ASAP (blocking development)
- [ ] This week
- [ ] This month
- [ ] No rush

### Resources Checked
**What resources have you already checked?**

- [ ] README.md
- [ ] Documentation
- [ ] Examples
- [ ] Stack Overflow
- [ ] GitHub Issues
- [ ] Other: _______________

## Priority
Please indicate the urgency:

- [ ] Critical (Blocking production deployment)
- [ ] High (Blocking development)
- [ ] Medium (Would like to know soon)
- [ ] Low (Just curious)

## Checklist
Before submitting, please ensure:

- [ ] I have provided a clear question
- [ ] I have described what I've tried
- [ ] I have included my current setup
- [ ] I have checked existing documentation
- [ ] I have provided sufficient context
- [ ] I have removed any sensitive information (signed URLs, etc.)

---

**We'll do our best to help you get unstuck! 🚀**

**For urgent issues, please also consider:**
- [FastPix Documentation](https://fastpix.com/docs)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/fastpix)
- [GitHub Discussions](https://github.com/FastPix/web-uploads-sdk/discussions)


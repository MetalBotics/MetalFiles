# MetalFiles File Transfer System
## MetalFiles

**Purpose:** Designed specifically for secure, ephemeral file sharing (such as secrets, environment files) and bigger files.

**Benefits:**
- **Ephemeral Links:** Files are available for a limited time or number of downloads, then deleted automatically.
- **Big file transfer:** Share up to 10gb files for free!
- **No Account Required:** Share files without making users register.
- **No File History:** Files are not stored long-term, reducing accidental leaks.
- **End-to-End Security:** Files encrypted end-to-end.
- **No Metadata Leaks:** Encrypted files and all data removed from the server upon download.
- **Developer-Friendly:** Tailored for secret sharing and developer workflows (e.g., sharing `.env` files, config, secrets).

---

## Discord

**Purpose:** Real-time chat and collaboration platform.

**Drawbacks for Sensitive Files:**
- **Persistence:** Files remain accessible in chat history unless deleted manually.
- **Not Ephemeral:** No built-in expiry or one-time-download.
- **Limited Security Controls:** Anyone with access to the channel can download files.
- **Not Designed for Secrets:** Risk of accidental leaks if channels are public or permissions are misconfigured.

---

## Google Drive (or similar cloud storage)

**Purpose:** General cloud file storage and collaboration.

**Drawbacks for Sensitive Files:**
- **Long-Term Storage:** Files stay until you manually remove them.
- **Link Sharing Risks:** Shared links can be forwarded, and access controls can be tricky.
- **Account Requirement:** Recipients often need a Google account.
- **Audit Trail:** File access and edits are logged (can be good or bad for privacy).
- **Not Ephemeral:** No easy way to set file expiration or one-time download.

---

## Summary Table

| Feature                   | MetalFiles      | Discord         | Google Drive     |
|---------------------------|----------------|-----------------|-----------------|
| Ephemeral Sharing         | ✅             | ❌              | ❌              |
| No Account Needed         | ✅             | ❌              | ❌              |
| 10gb File Transfer         | ✅             | ❌              | ✅              |
| Designed for Secrets      | ✅             | ❌              | ❌              |
| Easy One-Time Links       | ✅             | ❌              | ❌              |
| Auto-Delete After Access  | ✅             | ❌              | ❌              |
| Zero Metadata Retained | ✅             | ❌              | ❌              |
| Access Control Simplicity | ✅             | ❌ (channel)     | ⚠️ (settings)   |

---

MetalFiles is purpose-built for secure, temporary transfer of sensitive files, minimizing risks and friction. Discord and Drive are better for collaboration, but not for sharing secrets or files that should disappear after use.

# Implementation Plan: Authorization & Security Enhancements

## Overview
This plan outlines the implementation of document authorization, rate limiting, CSRF protection, and secure JWT storage for the BruinLM application.

---

## 1. Document Deletion Authorization ✅

### Current State
- Delete endpoint at `DELETE /api/files/:fileId` currently allows any authenticated user to delete any document
- Comment in code: "For now, allow anyone to delete" (line 228 in `files.js`)

### Implementation Steps

**1.1 Create Authorization Helper Function**
- Create a reusable middleware/helper function `canDeleteDocument(userId, documentId)`
- Check two conditions:
  - User is the document owner (`documents.uploaded_by === userId`)
  - User is the class owner (`classes.owner_id === userId` WHERE `classes.id = documents.class_id`)

**1.2 Update Delete Endpoint**
- Replace the placeholder comment with actual authorization check
- Query document and its associated class in a single JOIN query
- Return `403 Forbidden` if user is neither document owner nor class owner
- Keep existing file deletion logic (filesystem + database)

**Files to Modify:**
- `backend/backend/routes/routes/files.js` (lines 211-243)

---

## 2. Rate Limiting 🚦

### Implementation Steps

**2.1 Install Rate Limiting Package**
- Install `express-rate-limit` package

**2.2 Create Rate Limiting Middleware**
- Create a shared rate limiter configuration
- Apply different limits for different endpoints:
  - **General API**: 100 requests per 15 minutes per IP
  - **Auth endpoints** (login/register): 5 requests per 15 minutes per IP (prevent brute force)
  - **File upload**: 10 requests per hour per user (prevent abuse)
  - **File delete**: 20 requests per hour per user

**2.3 Apply Middleware**
- Apply to all routes in `server.js`
- Apply specific limits to auth routes in `auth.js`
- Apply specific limits to file routes in `files.js`

**Files to Create/Modify:**
- `backend/backend/middleware/rateLimiter.js` (new)
- `backend/backend/server.js`
- `backend/backend/routes/routes/auth.js`
- `backend/backend/routes/routes/files.js`

---

## 3. CSRF Protection 🛡️

### Implementation Steps

**3.1 Install CSRF Package**
- Install `csurf` or `csrf` package (Note: `csurf` is deprecated, use `csrf` with custom middleware)

**3.2 Create CSRF Middleware**
- Generate CSRF tokens for authenticated sessions
- Create endpoint: `GET /api/csrf-token` to return CSRF token
- Validate CSRF token on state-changing operations (POST, PUT, PATCH, DELETE)
- Skip CSRF for GET requests and WebSocket connections

**3.3 Frontend Integration** (Future)
- Frontend will need to fetch CSRF token and include in requests
- For now, implement backend-only (frontend can be updated separately)

**Files to Create/Modify:**
- `backend/backend/middleware/csrf.js` (new)
- `backend/backend/server.js`
- `backend/backend/routes/routes/auth.js` (add CSRF token endpoint)

---

## 4. Secure JWT Storage & HTTPS 🔒

### Implementation Steps

**4.1 Add Cookie Support**
- Install `cookie-parser` package
- Add cookie parser middleware to `server.js`

**4.2 Update Auth Routes**
- Modify `/api/auth/login` and `/api/auth/register` to:
  - Set JWT in httpOnly, secure cookie (when HTTPS available)
  - Still return JWT in response body (for backward compatibility)
  - Use environment variable to determine if HTTPS is enabled

**4.3 Update Authentication Middleware**
- Modify `authenticate` helper to check:
  1. Authorization header (Bearer token) - existing method
  2. httpOnly cookie - new method
  - Support both methods for backward compatibility

**4.4 Environment Configuration**
- Add `NODE_ENV` check: in production, enforce secure cookies
- Add `HTTPS_ENABLED` environment variable (optional, defaults to false for dev)

**4.5 HTTPS Enforcement** (Production)
- Add middleware to redirect HTTP to HTTPS in production
- Add security headers (HSTS, etc.)

**Files to Modify:**
- `backend/backend/routes/routes/auth.js`
- `backend/backend/routes/routes/files.js` (authenticate helper)
- `backend/backend/routes/routes/classes.js` (authenticate helper)
- `backend/backend/routes/routes/users.js` (authenticate helper)
- `backend/backend/routes/routes/chat.js` (if it has authenticate)
- `backend/backend/server.js`
- Create shared `middleware/auth.js` to centralize authentication logic

---

## Implementation Order (Recommended)

1. **Document Authorization** (Simplest, highest priority)
   - Quick win, directly addresses the requirement
   - Low risk, isolated change

2. **Rate Limiting** (Medium complexity)
   - Prevents abuse
   - Can be added incrementally

3. **Secure JWT Storage** (Medium complexity)
   - Improves security posture
   - Maintains backward compatibility

4. **CSRF Protection** (Most complex)
   - Requires frontend coordination
   - Can be implemented last

---

## Testing Checklist

- [ ] Document deletion: Only document owner or class owner can delete
- [ ] Document deletion: Other users get 403 Forbidden
- [ ] Rate limiting: Auth endpoints block after 5 failed attempts
- [ ] Rate limiting: File operations respect limits
- [ ] CSRF: State-changing operations require valid CSRF token
- [ ] JWT: Works via both Bearer token and cookie
- [ ] JWT: Cookies are httpOnly and secure in production
- [ ] HTTPS: Production redirects HTTP to HTTPS

---

## Dependencies to Install

```bash
npm install express-rate-limit cookie-parser csrf
```

---

## Environment Variables to Add

```env
# Security
HTTPS_ENABLED=false  # Set to true in production
NODE_ENV=development  # Set to production in production
```

---

## Notes

- **Backward Compatibility**: All changes maintain backward compatibility with existing frontend
- **Incremental Rollout**: Each feature can be implemented and tested independently
- **Production Considerations**: HTTPS enforcement and secure cookies only apply in production environment


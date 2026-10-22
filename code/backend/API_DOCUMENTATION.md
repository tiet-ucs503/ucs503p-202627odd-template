# TravelSphere — Backend API Endpoint Reference

This document details all 22 API endpoints available on the TravelSphere backend.

## Base Configuration & Headers
- **Base URL**: `http://localhost:8000` (Local) / `<DEPLOYED_URL>` (Production)
- **Auth Header**: `Authorization: Bearer <access_token>`
- **Content-Type**: `application/json` (except image uploads: `multipart/form-data`)

---

## Endpoint List

### 1. Health Check (Chunk 0)
- **`GET /api/health`**
  - Auth: None
  - Response 200: `{"status": "ok"}`

### 2. Authentication (Chunk 1)
- **`POST /api/auth/register`**
  - Auth: None
  - Request: `{"username": "amy_travels", "email": "amy@example.com", "password": "password123", "full_name": "Amy Chen"}`
  - Response 201: `{"id": 1, "username": "amy_travels", "email": "amy@example.com", "full_name": "Amy Chen"}`
  - Errors: 400 (username/email taken), 422 (validation error)

- **`POST /api/auth/login`**
  - Auth: None
  - Request: `{"username": "amy_travels", "password": "password123"}`
  - Response 200: `{"access_token": "eyJ...", "token_type": "bearer"}`
  - Errors: 401 (invalid credentials)

- **`POST /api/auth/logout`**
  - Auth: Bearer Token
  - Response 200: `{"detail": "logged out"}`

- **`GET /api/users/me`**
  - Auth: Bearer Token
  - Response 200: `{"id": 1, "username": "amy_travels", "email": "amy@example.com", "full_name": "Amy Chen"}`

### 3. User Profiles & Media Uploads (Chunks 2 & 7)
- **`GET /api/users/{user_id}`**
  - Auth: None
  - Response 200:
    ```json
    {
      "id": 1,
      "username": "amy_travels",
      "full_name": "Amy Chen",
      "bio": "Exploring the world",
      "profile_picture_url": "/uploads/images/xyz.png",
      "post_count": 5,
      "destinations_visited": [
        { "id": 2, "name": "Siem Reap, Cambodia", "country": "Cambodia" }
      ]
    }
    ```
  - Errors: 404 (user not found)

- **`PATCH /api/users/me`**
  - Auth: Bearer Token
  - Request (all optional): `{"full_name": "Amy C.", "bio": "Now in Vietnam", "profile_picture_url": "/uploads/images/abc.png"}`
  - Response 200: Updated `UserProfile` object

- **`POST /api/uploads/images`**
  - Auth: Bearer Token
  - Request: `multipart/form-data` with field `file`
  - Response 201: `{"url": "/uploads/images/uuid.ext"}`
  - Errors: 400 (invalid file type/size)

### 4. Travel Posts (Chunk 3)
- **`POST /api/posts`**
  - Auth: Bearer Token
  - Request: `{"content": "Sunrise at Angkor Wat", "destination_name": "Siem Reap, Cambodia", "image_url": "/uploads/images/xyz.jpg"}`
  - Response 201: `PostPublic` object containing nested `user` and `destination`
  - Errors: 401 (unauthenticated), 422 (validation)

- **`GET /api/posts/{post_id}`**
  - Auth: None
  - Response 200: `PostPublic` object
  - Errors: 404 (not found)

- **`GET /api/posts`**
  - Auth: None
  - Response 200: Array of `PostPublic` (most recent first)

- **`DELETE /api/posts/{post_id}`**
  - Auth: Bearer Token (must be post owner)
  - Response 204: No Content
  - Errors: 401 (unauthenticated), 403 (not owner), 404 (not found)

### 5. Following System (Chunk 4)
- **`GET /api/users?search=amy`**
  - Auth: None
  - Response 200: Array of `UserMinimal` (`id`, `username`, `full_name`, `profile_picture_url`)

- **`POST /api/follows`**
  - Auth: Bearer Token
  - Request: `{"followed_id": 4}`
  - Response 201: `{"follower_id": 1, "followed_id": 4, "created_at": "..."}`
  - Errors: 400 (self-follow / duplicate follow), 404 (target user not found)

- **`DELETE /api/follows/{followed_id}`**
  - Auth: Bearer Token
  - Response 204: No Content
  - Errors: 404 (not currently following)

- **`GET /api/users/{user_id}/followers`**
  - Auth: None
  - Response 200: Array of `UserMinimal`

- **`GET /api/users/{user_id}/following`**
  - Auth: None
  - Response 200: Array of `UserMinimal`

### 6. Personalized Feed (Chunk 5)
- **`GET /api/feed?skip=0&limit=20`**
  - Auth: Bearer Token
  - Response 200: `{"items": [PostPublic, ...], "total": 34}`
  - Errors: 401 (unauthenticated)

### 7. Destination Search & Details (Chunk 6)
- **`GET /api/destinations?search=bali`**
  - Auth: None
  - Response 200: Array of `DestinationMinimal` (`id`, `name`, `country`)

- **`GET /api/destinations/{destination_id}`**
  - Auth: None
  - Response 200: `DestinationPublic` (`id`, `name`, `country`, `latitude`, `longitude`)
  - Errors: 404 (not found)

- **`GET /api/destinations/{destination_id}/posts`**
  - Auth: None
  - Response 200: Array of `PostPublic` (most recent first)
  - Errors: 404 (not found)

- **`GET /api/destinations/{destination_id}/travelers`**
  - Auth: None
  - Response 200: Array of `UserMinimal` (deduplicated)
  - Errors: 404 (not found)

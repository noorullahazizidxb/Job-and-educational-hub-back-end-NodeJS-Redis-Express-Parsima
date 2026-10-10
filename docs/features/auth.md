# Auth

`src/routes/auth.js` → `src/services/auth.controller.js`. JWT helpers: `src/utils/jwt.js`. Request user: `src/middleware/authn.js`.

```mermaid
sequenceDiagram
  participant Client
  participant Login as POST /api/auth/login
  participant Captcha as verifyRecaptchaToken
  participant Db as Prisma User
  Client->>Login: email, password, recaptchaToken
  Login->>Captcha: expectedAction login
  Captcha-->>Login: ok or skip when secret empty
  Login->>Db: findUnique email
  Login-->>Client: token and user without passwordHash
  Client->>Login: GET /api/auth/me Bearer token
  Login-->>Client: cached or fresh user
```

Login is rate-limited (`LOGIN_RATE_LIMIT_POINTS`). On Vercel that limiter is process-local because Redis is off. `RECAPTCHA_SECRET_KEY` empty means the server does not reject a missing token.

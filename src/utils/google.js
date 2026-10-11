/**
 * Verifies a Google ID token from the Next.js OAuth callback.
 * Audience must match GOOGLE_CLIENT_ID. An empty client id skips nothing:
 * Google sign-in is refused until the client id is configured.
 */
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const err = new Error('Google sign-in is not configured');
    err.status = 503;
    throw err;
  }
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('Google ID token is required');
    err.status = 400;
    throw err;
  }

  const response = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.sub) {
    const err = new Error('Google ID token is invalid');
    err.status = 401;
    throw err;
  }
  if (data.aud !== clientId) {
    const err = new Error('Google ID token audience mismatch');
    err.status = 401;
    throw err;
  }
  const verified = data.email_verified === true || data.email_verified === 'true';
  if (!verified || typeof data.email !== 'string' || !data.email) {
    const err = new Error('Google account email is not verified');
    err.status = 401;
    throw err;
  }

  return {
    sub: String(data.sub),
    email: data.email.toLowerCase(),
    name: typeof data.name === 'string' ? data.name : null,
    picture: typeof data.picture === 'string' ? data.picture : null,
  };
}

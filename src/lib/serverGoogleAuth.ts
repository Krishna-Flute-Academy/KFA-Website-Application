import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

/**
 * Safely reads an environment variable from process.env or local .env fallback
 */
export function getEnvVariable(key: string): string {
    if (process.env[key]) return process.env[key]!;
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                const parts = line.split('=');
                if (parts[0]?.trim() === key) {
                    return parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                }
            }
        }
    } catch (e) {
        // Ignore fallback errors
    }
    return '';
}

/**
 * Obtains a valid short-lived Google Drive Access Token on the server side
 * Prioritizes Academy OAuth 2.0 Refresh Token (full user drive ownership)
 * with graceful fallback to Service Account JWT.
 */
export async function getAcademyGoogleAccessToken(): Promise<{
    accessToken: string;
    folderId: string;
    authType: 'oauth_refresh' | 'service_account';
}> {
    const folderId = getEnvVariable('GOOGLE_DRIVE_FOLDER_ID') || '1WV52LDvbHivSxkjEi4tEw1YKB9NGspnt';
    const clientId = getEnvVariable('GOOGLE_CLIENT_ID');
    const clientSecret = getEnvVariable('GOOGLE_CLIENT_SECRET');
    const refreshToken = getEnvVariable('GOOGLE_REFRESH_TOKEN');

    // 1. Preferred: Academy OAuth 2.0 Refresh Token
    if (clientId && clientSecret && refreshToken) {
        try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            if (tokenRes.ok) {
                const data = await tokenRes.json();
                if (data.access_token) {
                    return {
                        accessToken: data.access_token,
                        folderId,
                        authType: 'oauth_refresh',
                    };
                }
            } else {
                const errText = await tokenRes.text();
                console.error('Google OAuth Refresh Token exchange failed:', {
                    status: tokenRes.status,
                    body: errText,
                });
            }
        } catch (oauthErr) {
            console.error('Error refreshing Google OAuth token:', oauthErr);
        }
    }

    // 2. Service Account JWT Authentication
    const clientEmail = getEnvVariable('GOOGLE_CLIENT_EMAIL');
    const privateKeyRaw = getEnvVariable('GOOGLE_PRIVATE_KEY');
    const privateKey = privateKeyRaw?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
        try {
            const client = new JWT({
                email: clientEmail,
                key: privateKey,
                scopes: [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/drive.file'
                ],
            });

            const tokenInfo = await client.getAccessToken();
            if (tokenInfo.token) {
                return {
                    accessToken: tokenInfo.token,
                    folderId,
                    authType: 'service_account',
                };
            }
        } catch (jwtErr) {
            console.error('Error getting Google Service Account JWT token:', jwtErr);
        }
    }

    throw new Error('No valid Google Drive authentication credentials configured on server.');
}

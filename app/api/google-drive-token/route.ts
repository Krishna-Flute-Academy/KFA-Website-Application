import { NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

function getEnvVariable(key: string): string {
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
        // Ignore
    }
    return '';
}

export async function POST(req: Request) {
    try {
        // Require auth token from frontend
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || getEnvVariable('GOOGLE_CLIENT_EMAIL');
        const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || getEnvVariable('GOOGLE_PRIVATE_KEY');
        const privateKey = privateKeyRaw?.replace(/\\n/g, '\n');
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || getEnvVariable('GOOGLE_DRIVE_FOLDER_ID');
        
        if (!clientEmail || !privateKey || !folderId) {
            console.error('Missing Google Drive credentials:', { hasEmail: !!clientEmail, hasKey: !!privateKey, hasFolder: !!folderId });
            return NextResponse.json({ error: 'Google Drive credentials not fully configured on server' }, { status: 500 });
        }

        const client = new JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        const tokenInfo = await client.getAccessToken();
        
        if (!tokenInfo.token) {
            throw new Error('Failed to retrieve access token from Google');
        }

        return NextResponse.json({
            access_token: tokenInfo.token,
            folder_id: folderId
        });
    } catch (error: any) {
        console.error('Error getting Google Drive token:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

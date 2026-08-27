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

        const clientEmail = getEnvVariable('GOOGLE_CLIENT_EMAIL');
        const privateKeyRaw = getEnvVariable('GOOGLE_PRIVATE_KEY');
        const privateKey = privateKeyRaw?.replace(/\\n/g, '\n');
        const folderIdRaw = getEnvVariable('GOOGLE_DRIVE_FOLDER_ID');
        // Accept either a bare ID or a full Drive URL like https://drive.google.com/drive/folders/<ID>
        const folderIdMatch = folderIdRaw.match(/[-\w]{25,}/);
        const folderId = folderIdMatch ? folderIdMatch[0] : folderIdRaw;
        
        if (!clientEmail || !privateKey || !folderId) {
            console.error('Missing Google Drive credentials:', { hasEmail: !!clientEmail, hasKey: !!privateKey, hasFolder: !!folderId });
            return NextResponse.json({ error: 'Google Drive credentials not fully configured on server' }, { status: 500 });
        }

        const client = new JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
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

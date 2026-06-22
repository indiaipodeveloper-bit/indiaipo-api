import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadMizan = async (
    file,
    prefix = '',
    folder = ''
) => {
    try {
        if (!file) {
            return null;
        }

        // Generate filename
        const ext = path.extname(file.originalname);
        const randomString = Math.random().toString(36).substring(2, 10);
        const filename = `${prefix}_${Date.now()}${randomString}${ext}`;

        // 1. If central upload API is configured, try it first
        if (process.env.UPLOAD_API_URL) {
            try {
                const formData = new FormData();
                formData.append('folder', folder);
                formData.append('file', file.buffer, filename);

                const uploadUrl = new URL(process.env.UPLOAD_API_URL);
                uploadUrl.searchParams.append('folder', folder);

                const response = await axios.post(
                    uploadUrl.toString(),
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),
                            'x-api-key': process.env.UPLOAD_API_KEY
                        },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity
                    }
                );

                if (response.data && response.data.url) {
                    return response.data.url;
                }
            } catch (apiErr) {
                console.error("Central API upload failed in uploadMizan, falling back to local save:", apiErr.message);
            }
        }

        // 2. Local Save Fallback (Runs if central API is missing or fails)
        const uploadDir = process.env.UPLOADS_PATH || './uploads';
        const resolvedUploadsPath = path.resolve(__dirname, '..', uploadDir);
        const dynamicDir = path.join(resolvedUploadsPath, folder);

        try {
            await fs.mkdir(dynamicDir, { recursive: true });
        } catch (dirErr) {
            console.error("Local folder creation error in uploadMizan:", dirErr.message);
        }

        const filePath = path.join(dynamicDir, filename);
        await fs.writeFile(filePath, file.buffer);

        // Return path starting with /uploads
        return `/uploads/${folder}/${filename}`;

    } catch (err) {
        console.error("uploadMizan final error:", err);
        return null;
    }
};
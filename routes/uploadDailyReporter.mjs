import express from 'express';
import multer from 'multer';

import { uploadMizan }
    from '../helpers/uploadMizan.mjs';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage()
});

router.post(
    '/',
    upload.single('file'),
    async (req, res) => {

        try {

            console.log(
                '\n====== DAILY REPORTER UPLOAD ======'
            );

            if (!req.file) {

                return res.status(400).json({
                    error: 'No file uploaded'
                });

            }

            console.log(
                '📁 FILE:',
                req.file.originalname
            );

            console.log(
                '📂 BODY:',
                req.body
            );

            // folder
            const folder =
                req.body.folder
                || 'dailyreporter';

            console.log(
                '📂 FINAL FOLDER:',
                folder
            );

            // upload helper
            const url =
                await uploadMizan(
                    req.file,
                    'dailyreporter',
                    folder
                );

            console.log(
                '🌍 URL:',
                url
            );

            console.log(
                '====== END ======\n'
            );

            return res.json({
                success: true,
                url
            });

        } catch (err) {

            console.log(
                '\n❌ DAILY REPORTER ERROR ❌'
            );

            console.error(err);

            return res.status(500).json({
                error: 'Upload failed'
            });

        }

    }
);

export default router;
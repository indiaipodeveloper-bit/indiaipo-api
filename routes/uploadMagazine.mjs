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





            if (!req.file) {



                return res.status(400).json({
                    error: 'No file uploaded'
                });
            }

            // folder frontend se aayega
            const folder =
                req.body.folder || 'magazine';



            // helper call
            const url =
                await uploadMizan(
                    req.file,
                    'magazine',
                    folder
                );
            return res.json({
                success: true,
                url
            });

        } catch (err) {


            return res.status(500).json({
                error: 'Upload failed'
            });

        }

    }
);

export default router;
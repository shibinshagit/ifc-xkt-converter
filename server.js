const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const port = 3000;

// Configure multer for file uploads with original extension
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');
fs.mkdir(uploadsDir, { recursive: true });
fs.mkdir(downloadsDir, { recursive: true });

// Conversion endpoint
app.post('/convert', upload.array('ifcFiles'), async (req, res) => {
    try {
        const files = req.files;
        const outputFiles = [];

        // Process each file sequentially
        for (const file of files) {
            const ifcPath = path.resolve(__dirname, file.path); // Use absolute path
            const outputName = `${path.basename(file.originalname, '.ifc')}.xkt`;
            const outputPath = path.join(downloadsDir, outputName);

            // Run convert2xkt.js with absolute path
            const command = `node convert2xkt.js -s "${ifcPath}" -o "${outputPath}" -l`;
            await execPromise(command, { cwd: path.join(__dirname, 'xeokit-convert') });

            outputFiles.push({
                name: outputName,
                url: `/downloads/${outputName}`
            });

            // Clean up uploaded file
            await fs.unlink(ifcPath);
        }

        res.json({ files: outputFiles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Conversion failed' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
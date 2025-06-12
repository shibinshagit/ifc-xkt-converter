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
            const ifcPath = path.resolve(__dirname, file.path);
            const outputName = `${path.basename(file.originalname, '.ifc')}.xkt`;
            const outputPath = path.join(downloadsDir, outputName);

            console.log(`Converting: ${ifcPath} -> ${outputPath}`);

            // Use npx to run the converter (recommended approach)
            const command = `npx convert2xkt -s "${ifcPath}" -o "${outputPath}" -l`;
            
            try {
                const { stdout, stderr } = await execPromise(command, { 
                    cwd: __dirname,
                    timeout: 300000 // 5 minute timeout
                });
                
                console.log('Conversion stdout:', stdout);
                if (stderr) console.log('Conversion stderr:', stderr);
                
                outputFiles.push({
                    name: outputName,
                    url: `/downloads/${outputName}`
                });
                
            } catch (conversionError) {
                console.error('Conversion error:', conversionError);
                
                // Try alternative method using node_modules path
                console.log('Trying alternative method...');
                const altCommand = `node ./node_modules/@xeokit/xeokit-convert/convert2xkt.js -s "${ifcPath}" -o "${outputPath}" -l`;
                
                try {
                    const { stdout, stderr } = await execPromise(altCommand, { 
                        cwd: __dirname,
                        timeout: 300000
                    });
                    
                    console.log('Alternative conversion stdout:', stdout);
                    if (stderr) console.log('Alternative conversion stderr:', stderr);
                    
                    outputFiles.push({
                        name: outputName,
                        url: `/downloads/${outputName}`
                    });
                    
                } catch (altError) {
                    console.error('Alternative conversion also failed:', altError);
                    throw altError;
                }
            }

            // Clean up uploaded file
            try {
                await fs.unlink(ifcPath);
            } catch (unlinkError) {
                console.warn('Could not delete uploaded file:', unlinkError);
            }
        }

        res.json({ files: outputFiles });
        
    } catch (error) {
        console.error('Overall conversion error:', error);
        res.status(500).json({ 
            error: 'Conversion failed', 
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
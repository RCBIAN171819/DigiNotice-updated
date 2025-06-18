// server.js - Backend for Digital Notice Board

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Storage configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public', 'uploads');
        
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueFilename = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
    }
});

// Configure multer for file upload
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    fileFilter: function (req, file, cb) {
        // Accept only specific file types
        const filetypes = /jpeg|jpg|png|gif|mp4/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only .jpeg, .jpg, .png, .gif and .mp4 files are allowed'));
        }
    }
});

// File to store content data
const contentDataFile = path.join(__dirname, 'content-data.json');

// Helper function to read content data
function readContentData() {
    if (!fs.existsSync(contentDataFile)) {
        return [];
    }
    
    try {
        const data = fs.readFileSync(contentDataFile, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error reading content data:', error);
        return [];
    }
}

// Helper function to write content data
function writeContentData(data) {
    try {
        fs.writeFileSync(contentDataFile, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing content data:', error);
        return false;
    }
}

// Function to broadcast content updates to all connected clients
function broadcastContentUpdate() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'content-updated' }));
        }
    });
}

// Routes
// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve the display page
app.get('/display.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

// API endpoint to get all content
app.get('/api/content', (req, res) => {
    const contentData = readContentData();
    res.json(contentData);
});

// API endpoint to upload files
app.post('/api/upload', upload.array('files'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const contentData = readContentData();
        
        // Process uploaded files
        const uploadedFiles = req.files.map(file => {
            const fileType = file.mimetype.startsWith('image') ? 'image' : 'video';
            
            return {
                id: uuidv4(),
                type: fileType,
                filename: file.filename,
                originalName: file.originalname,
                url: `/uploads/${file.filename}`,
                mimetype: file.mimetype,
                size: file.size,
                createdAt: new Date().toISOString(),
                duration: fileType === 'image' ? 10 : 0 // Default duration for images
            };
        });
        
        // Add new files to content data
        contentData.push(...uploadedFiles);
        
        // Save updated content data
        if (writeContentData(contentData)) {
            broadcastContentUpdate();
            return res.json({ 
                success: true, 
                uploaded: uploadedFiles.length,
                files: uploadedFiles 
            });
        } else {
            return res.status(500).json({ error: 'Failed to save content data' });
        }
    } catch (error) {
        console.error('Error handling file upload:', error);
        return res.status(500).json({ error: 'Failed to upload files' });
    }
});

// API endpoint to add text content
app.post('/api/text', (req, res) => {
    try {
        const { content, color, size, duration } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Text content is required' });
        }
        
        const contentData = readContentData();
        
        // Create new text content item
        const textItem = {
            id: uuidv4(),
            type: 'text',
            content: content,
            color: color || '#FFFFFF',
            size: size || 'medium',
            duration: parseInt(duration, 10) || 30,
            createdAt: new Date().toISOString()
        };
        
        // Add new text item to content data
        contentData.push(textItem);
        
        // Save updated content data
        if (writeContentData(contentData)) {
            broadcastContentUpdate();
            return res.json({ 
                success: true, 
                item: textItem 
            });
        } else {
            return res.status(500).json({ error: 'Failed to save content data' });
        }
    } catch (error) {
        console.error('Error adding text content:', error);
        return res.status(500).json({ error: 'Failed to add text content' });
    }
});

// API endpoint to delete content item
app.delete('/api/content/:id', (req, res) => {
    try {
        const contentId = req.params.id;
        let contentData = readContentData();
        
        // Find item by ID
        const itemIndex = contentData.findIndex(item => item.id === contentId);
        
        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Content item not found' });
        }
        
        // Check if item is a file type and delete the file
        const item = contentData[itemIndex];
        if ((item.type === 'image' || item.type === 'video') && item.filename) {
            const filePath = path.join(__dirname, 'public', 'uploads', item.filename);
            
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        // Remove item from content data
        contentData.splice(itemIndex, 1);
        
        // Save updated content data
        if (writeContentData(contentData)) {
            broadcastContentUpdate();
            return res.json({ 
                success: true, 
                message: 'Content item deleted successfully' 
            });
        } else {
            return res.status(500).json({ error: 'Failed to save content data' });
        }
    } catch (error) {
        console.error('Error deleting content item:', error);
        return res.status(500).json({ error: 'Failed to delete content item' });
    }
});

// API endpoint to reorder content
app.post('/api/reorder', (req, res) => {
    try {
        const { index, direction } = req.body;
        let contentData = readContentData();
        
        if (index < 0 || index >= contentData.length) {
            return res.status(400).json({ error: 'Invalid index' });
        }
        
        // Determine target index
        let newIndex;
        if (direction === 'up') {
            newIndex = index > 0 ? index - 1 : 0;
        } else if (direction === 'down') {
            newIndex = index < contentData.length - 1 ? index + 1 : contentData.length - 1;
        } else {
            return res.status(400).json({ error: 'Invalid direction' });
        }
        
        // Skip if no change needed
        if (newIndex === index) {
            return res.json({ success: true, message: 'No change needed' });
        }
        
        // Swap items
        const item = contentData[index];
        contentData.splice(index, 1);
        contentData.splice(newIndex, 0, item);
        
        // Save updated content data
        if (writeContentData(contentData)) {
            broadcastContentUpdate();
            return res.json({ 
                success: true, 
                message: 'Content reordered successfully' 
            });
        } else {
            return res.status(500).json({ error: 'Failed to save content data' });
        }
    } catch (error) {
        console.error('Error reordering content:', error);
        return res.status(500).json({ error: 'Failed to reorder content' });
    }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Create initial directories and files if they don't exist
function initializeApp() {
    const publicDir = path.join(__dirname, 'public');
    const uploadsDir = path.join(publicDir, 'uploads');
    
    // Create public directory if it doesn't exist
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create content data file if it doesn't exist
    if (!fs.existsSync(contentDataFile)) {
        writeContentData([]);
    }
    
    // Copy HTML and JS files to public directory
    copyFileToPublic('dashboard.html');
    copyFileToPublic('display.html');
    copyFileToPublic('frontend.js');
}

// Helper function to copy a file to the public directory
function copyFileToPublic(filename) {
    const sourcePath = path.join(__dirname, filename);
    const destPath = path.join(__dirname, 'public', filename);
    
    // Only copy if source exists and destination doesn't or is older
    if (fs.existsSync(sourcePath)) {
        if (!fs.existsSync(destPath) || 
            fs.statSync(sourcePath).mtime > fs.statSync(destPath).mtime) {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`Copied ${filename} to public directory`);
        }
    }
}

// Initialize application
initializeApp();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Digital Notice Board server is running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/`);
    console.log(`Display: http://localhost:${PORT}/display.html`);
});
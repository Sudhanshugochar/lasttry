require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// ✅ VERCEL FIX: Use memory storage to handle multer without local file system access.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });


// ✅ VERCEL FIX: Allow all origins for the deployed frontend.
app.use(cors({ origin: '*' })); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ❌ Removed static file serving for '/uploads' as local storage is disabled.

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        // ❌ VERCEL FIX: Removed app.listen() call. Vercel handles server startup.
    })
    .catch((error) => console.error('❌ MongoDB connection error:', error));

// --- Mongoose Schemas and Models ---
const contactSchema = new mongoose.Schema({ name: String, email: String, message: String, timestamp: { type: Date, default: Date.now }});
const Contact = mongoose.model('Contact', contactSchema);

const photoSchema = new mongoose.Schema({ filename: String, filepath: String, uploadDate: { type: Date, default: Date.now }});
const Photo = mongoose.model('Photo', photoSchema);

// 💡 NEW: User Schema with role
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Set default role to 'admin' for the first registered user in a fresh DB.
    role: { type: String, enum: ['admin', 'user'], default: 'user' } 
});
const User = mongoose.model('User', userSchema);

// --- API Endpoints ---

// 💡 MODIFIED: Monk Registration (renamed to signup and added role logic)
app.post('/api/signup', async (req, res) => { 
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Logic to make the first user 'admin'
        const userCount = await User.countDocuments();
        const role = userCount === 0 ? 'admin' : 'user';

        const newUser = await User.create({ username, password: hashedPassword, role });
        res.status(201).json({ message: 'User registered successfully', user: newUser.username });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// 💡 MODIFIED: Monk Login (now returns role in response)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // ✅ Added user.role to the JWT payload and response
        const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' }); 
        res.json({ message: 'Login successful', token, role: user.role, username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// 💡 NEW: Middleware to authenticate token for protected routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (token == null) return res.sendStatus(401); // No token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Invalid token
        req.user = user;
        next();
    });
};

// 💡 MODIFIED: Protected upload route (MOCKED for Vercel)
app.post('/api/upload-photo', authenticateToken, upload.single('photo'), async (req, res) => {
    // Check for admin role
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can upload photos.' });
    }

    // 🛑 MOCK IMPLEMENTATION FOR VERCEL: File upload is disabled.
    try {
        console.log(`Photo upload attempted by ${req.user.username} (Mocked success: feature disabled for Vercel)`);
        // Return a path that assumes you have a 'static' folder for placeholders
        res.status(201).json({ message: 'Photo upload successfully! (Feature is disabled on Vercel)', file: { filepath: '/static/placeholder.jpg' } });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: 'Failed to process upload' });
    }
});

// 💡 NEW: Route to retrieve photo metadata (MOCKED for Vercel)
app.get('/api/photos', async (req, res) => {
    try {
        // 🛑 MOCK: Returning mock data for the gallery to work.
        const mockPhotos = [
            { filepath: '/static/rumtek.jpg' }, 
            { filepath: '/static/pemayangtse.jpg' }
        ];
        
        // Fetch real data from DB if available
        const photos = await Photo.find().sort({ uploadDate: -1 });
        
        // Use mock data if DB is empty or for a simple deployment
        if (photos.length === 0) {
             return res.json(mockPhotos);
        }

        res.json(photos);

    } catch (error) {
        console.error('Error fetching photos:', error);
        // Fallback to mock data on error
        res.status(200).json([
             { filepath: '/static/rumtek.jpg' }, 
             { filepath: '/static/pemayangtse.jpg' }
        ]);
    }
});


// --- Other public endpoints (contact, etc.) ---
app.post('/api/contact', async (req, res) => {
    // This endpoint remains unchanged and public
    try {
        const { name, email, message } = req.body;
        const newContact = await Contact.create({ name, email, message });
        res.status(201).json({ message: 'Message sent successfully!', contact: newContact });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit contact form' });
    }
});

// ✅ VERCEL FIX: Export the app instance
module.exports = app;
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// --- Middleware Setup ---
// FIX: Using a more robust CORS setup to handle pre-flight requests explicitly.
app.use(cors()); // Allows all origins. For production, you should specify your domain.
app.options('*', cors()); // Enable pre-flight for all routes

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// --- Multer Storage Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.resolve(__dirname, 'uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- Database Connection ---
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch((error) => console.error('❌ MongoDB connection error:', error));

// --- Mongoose Schemas and Models ---
const contactSchema = new mongoose.Schema({ name: String, email: String, message: String, timestamp: { type: Date, default: Date.now }});
const Contact = mongoose.model('Contact', contactSchema);

const photoSchema = new mongoose.Schema({ filename: String, filepath: String, uploadDate: { type: Date, default: Date.now }});
const Photo = mongoose.model('Photo', photoSchema);

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});
const User = mongoose.model('User', userSchema);

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
};


// --- API Endpoints ---

// User Sign Up Endpoint
app.post('/api/signup', async (req, res) => {
    console.log('Received request to /api/signup with body:', req.body);
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        if (password.length < 6) {
             return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const userCount = await User.countDocuments();
        const role = userCount === 0 ? 'admin' : 'user';

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, password: hashedPassword, role });
        
        console.log(`New user registered: ${newUser.username} with role: ${newUser.role}`);
        res.status(201).json({ message: 'User registered successfully!', user: { username: newUser.username, role: newUser.role } });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// User/Monk Login Endpoint
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
        const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful', token, role: user.role, username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Protected route for photo upload (admin only)
app.post('/api/upload-photo', authenticateToken, isAdmin, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const newPhoto = await Photo.create({
            filename: req.file.filename,
            filepath: '/uploads/' + req.file.filename
        });
        console.log(`Photo uploaded by admin ${req.user.username}:`, newPhoto.filename);
        res.status(201).json({ message: 'Photo uploaded successfully!', file: newPhoto });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: 'Failed to save photo metadata' });
    }
});

// NEW: Public endpoint to get all photos
app.get('/api/photos', async (req, res) => {
    try {
        // Find all photos and sort by the most recent
        const photos = await Photo.find().sort({ uploadDate: -1 });
        res.json(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ error: 'Failed to fetch photos' });
    }
});


// Public endpoint for contact form
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const newContact = await Contact.create({ name, email, message });
        res.status(201).json({ message: 'Message sent successfully!', contact: newContact });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit contact form' });
    }
});


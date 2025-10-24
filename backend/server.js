// server.js - Enhanced Express server with JWT authentication
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// Enhanced Task Schema
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    trim: true,
    default: 'general'
  },
  tags: [{
    type: String,
    trim: true
  }],
  dueDate: {
    type: Date
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Task = mongoose.model('Task', taskSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Auth Routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or username' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();
    console.log('✅ User registered:', username);

    // Generate token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ message: 'Server error during registration: ' + err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Task Routes (Protected)

// Get all tasks for user with filtering and search
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { search, category, priority, completed, sortBy } = req.query;
    
    let query = { userId: req.user.userId };

    // Search in title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by priority
    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    // Filter by completion status
    if (completed !== undefined && completed !== 'all') {
      query.completed = completed === 'true';
    }

    // Sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy === 'dueDate') {
      sortOptions = { dueDate: 1, createdAt: -1 };
    } else if (sortBy === 'priority') {
      sortOptions = { priority: -1, createdAt: -1 };
    } else if (sortBy === 'title') {
      sortOptions = { title: 1 };
    }

    const tasks = await Task.find(query).sort(sortOptions);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single task
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });
    
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get task statistics
app.get('/api/tasks/stats/summary', authenticateToken, async (req, res) => {
  try {
    const total = await Task.countDocuments({ userId: req.user.userId });
    const completed = await Task.countDocuments({ userId: req.user.userId, completed: true });
    const pending = total - completed;
    
    const byPriority = await Task.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.userId) } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const byCategory = await Task.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.userId) } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    res.json({
      total,
      completed,
      pending,
      byPriority,
      byCategory
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const task = new Task({
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority || 'medium',
      category: req.body.category || 'general',
      tags: req.body.tags || [],
      dueDate: req.body.dueDate,
      userId: req.user.userId
    });

    const newTask = await task.save();
    res.status(201).json(newTask);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update task
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Update fields
    if (req.body.title !== undefined) task.title = req.body.title;
    if (req.body.description !== undefined) task.description = req.body.description;
    if (req.body.completed !== undefined) task.completed = req.body.completed;
    if (req.body.priority !== undefined) task.priority = req.body.priority;
    if (req.body.category !== undefined) task.category = req.body.category;
    if (req.body.tags !== undefined) task.tags = req.body.tags;
    if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate;

    const updatedTask = await task.save();
    res.json(updatedTask);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get unique categories for user
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await Task.distinct('category', { userId: req.user.userId });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get unique tags for user
app.get('/api/tags', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.userId });
    const allTags = tasks.reduce((tags, task) => [...tags, ...task.tags], []);
    const uniqueTags = [...new Set(allTags)];
    res.json(uniqueTags);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Task Manager API v2.0 is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
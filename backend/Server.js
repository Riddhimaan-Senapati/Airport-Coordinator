// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_CONNECTION_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const flightSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  arrivalDateTime: {
    type: Date,
    required: true
  },
  airport: {
    type: String,
    required: true
  }
});

const Flight = mongoose.model('Flight', flightSchema);

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    match: /@umass\.edu$/
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

app.use(bodyParser.json());

// API endpoint to handle email submission

// API endpoint to handle flight arrival submission
app.post('/api/flights', async (req, res) => {
  const { email, arrivalDateTime, airport } = req.body;

  try {
    // Save flight arrival data to database
    const newFlight = new Flight({ email, arrivalDateTime, airport });
    await newFlight.save();
    res.status(201).json({ message: 'Flight arrival data saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Example using Express.js
app.get('/filterData', async (req, res) => {
  try {
    const {arrivalDateTime, duration, airport, email } = req.query;
    // Parse flight time and duration
    const threshold= duration
    // Query MongoDB to filter data
    console.log(threshold)
    const filteredData = await Flight.find({ 
      airport,
      arrivalDateTime: { $lte: threshold,
        $gte: arrivalDateTime } ,
      email: { $ne: email } 
    }, { email: 1, arrivalDateTime: 1 });  
    res.json(filteredData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Signup endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const user = new User({ email, password });
    await user.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Signin endpoint
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({ token, email: user.email });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

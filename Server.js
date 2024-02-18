// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://rsenapati:55DwojaRhQDW4QnM@amherstscheduler.inlln8s.mongodb.net/Schedule?retryWrites=true&w=majority')
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
    const { duration, airport, email } = req.query;
    // Parse flight time and duration
    console.log(2)
    const threshold= duration
    // Query MongoDB to filter data
    console.log(threshold)
    const filteredData = await Flight.find({ 
      airport,
      arrivalDateTime: { $lt: threshold } 
    }, { email: 1, arrivalDateTime: 1 });  
    res.json(filteredData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

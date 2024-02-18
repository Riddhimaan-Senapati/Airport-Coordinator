// ResultsPage.js
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';


const Result = () => {
  const [email, setEmail] = useState('');
  const [arrivalDateTime, setArrivalDateTime] = useState('');
  const [airport, setAirport] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState('');
  let location = useLocation();
  

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    setArrivalDateTime(searchParams.get('arrivalDateTime'));
    setAirport(searchParams.get('airport'));
    setEmail(searchParams.get('email'));
  }, [location.search]);

  useEffect(() => {
    const saveDataToDatabase = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/flights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, arrivalDateTime, airport })
        });
        if (!response.ok) {
          setError('Failed to save data');
        }
      } catch (error) {
        console.error(error);
        setError('Server error');
      }
    };
    if (email && arrivalDateTime && airport) {
      saveDataToDatabase();
    }
  }, [email, arrivalDateTime, airport]);

  const [results, setResults] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Send request to backend to filter data
    try {
      console.log(`/filterData?duration=${duration}&airport=${airport}&email=${encodeURIComponent(email)}`)
      const response = await fetch(`http://localhost:5000/filterData?duration=${duration}&airport=${airport}&email=${encodeURIComponent(email)}`,
      {
        method: "GET"
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };


  return (
    <div>
      <h1>Results Page</h1>
      <p>Email: {email}</p>
      <p>Arrival Date-Time: {arrivalDateTime}</p>
      <p>Airport: {airport}</p>
      <form onSubmit={handleSubmit}>
        <label>
          EndTime that you are willing to stay:
          <input 
          type="datetime-local" 
          value={duration} 
          onChange={(e) => setDuration(e.target.value)} 
          required 
        />
        </label>
        <button type="submit">Filter</button>
      </form>
      {/* Display filtered results */}
      <ul>
        {results.map((result, index) => (
          <li key={index}>{result.email} - {result.arrivalDateTime}</li>
        ))}
      </ul>
      {error && <p>{error}</p>}
    </div>
  );
};

export default Result;

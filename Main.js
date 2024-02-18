// MainPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

const Main = () => {
  const [arrivalDateTime, setArrivalDateTime] = useState('');
  const [airport, setAirport] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const email = new URLSearchParams(location.search).get('email');

  useEffect(() => {
    // Reset form fields when component mounts
    setArrivalDateTime('');
    setAirport('');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(`/Result?email=${encodeURIComponent(email)}&arrivalDateTime=${encodeURIComponent(arrivalDateTime)}&airport=${encodeURIComponent(airport)}`);
  };

  return (
    <div>
      <h1>Main Page</h1>
      <form onSubmit={handleSubmit}>
        <input 
          type="datetime-local" 
          value={arrivalDateTime} 
          onChange={(e) => setArrivalDateTime(e.target.value)} 
          required 
        />
        <input 
          type="text" 
          placeholder="Enter airport" 
          value={airport} 
          onChange={(e) => setAirport(e.target.value)} 
          required 
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default Main;

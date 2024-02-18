// LandingPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';


const LandingPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.endsWith('umass.edu')) {
      navigate(`/Main?email=${encodeURIComponent(email)}`);
    } else {
      setError('Please provide a valid umass.edu email address.');
    }
  };

  return (
    <div>
      <h1>Welcome!</h1>
      <form onSubmit={handleSubmit}>
        <input 
          type="email" 
          placeholder="Enter your umass.edu email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        <button type="submit">Submit</button>
      </form>
      {error && <p>{error}</p>}
    </div>
  );
};

export default LandingPage;

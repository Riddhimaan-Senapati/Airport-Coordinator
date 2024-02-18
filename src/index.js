import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"; // Import BrowserRouter
import LandingPage from "../LandingPage";
import Main from "../Main";
import Result from "../Result";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Router>
    <Routes>
      <Route path="/" element={<LandingPage />}  />
      <Route path="/Main" element={<Main />} />
      <Route path="/Result" element={<Result/>} />
    </Routes>
  </Router>
);

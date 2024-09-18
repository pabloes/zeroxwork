import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from "./pages/Home";
import BrainWallet from "./pages/BrainWallet";
import OldBrainWallet from "./pages/OldBrainWallet";
import Register from "./pages/Register";

const App: React.FC = () => {
    return (
        <Router>

                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/eth-brain-wallet" element={<BrainWallet />} />
                    <Route path="/brain-wallet" element={<BrainWallet />} />
                    <Route path="/old-brain-wallet" element={<OldBrainWallet />} />
                </Routes>

        </Router>
    );
};

export default App;

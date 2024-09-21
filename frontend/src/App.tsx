import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from "./pages/Home";
import BrainWallet from "./pages/BrainWallet";
import OldBrainWallet from "./pages/OldBrainWallet";
import Register from "./pages/Register";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Login from "./pages/Login";
import {AuthProvider} from "./context/AuthContext";
import ImageUploadPage from "./pages/ImageUploadPage";
import ImageUploadedPage from "./pages/ImageUploadedPage";
import MyImagesPage from "./pages/MyImagesPage";

const App: React.FC = () => {
    return (<AuthProvider>
        <Router>
            <div className="app-container">
                <Header />
                <div className="main-content">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/image-upload" element={<ImageUploadPage />} />
                        <Route path="/uploaded-image-page/:sha256" element={<ImageUploadedPage />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/eth-brain-wallet" element={<BrainWallet />} />
                        <Route path="/brain-wallet" element={<BrainWallet />} />
                        <Route path="/old-brain-wallet" element={<OldBrainWallet />} />
                        <Route path="/my-images" element={<MyImagesPage />} />
                    </Routes>
                </div>
                <Footer/>
            </div>
        </Router>
        </AuthProvider>
    );
};

export default App;

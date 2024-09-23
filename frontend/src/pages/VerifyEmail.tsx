import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import UIkit from "uikit";

const VerifyEmail = () => {
    const [message, setMessage] = useState('');
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        // Extract the token from the URL query parameters
        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get('token');

        if (token) {
            // Call the verify endpoint
            axios
                .post('/api/auth/verify', { token })
                .then((response) => {
                    setMessage('Your email has been successfully verified!');
                    UIkit.notification({message:'Your email has been successfully verified!\nRedirecting to Login Page...', status:"success"});
                    // Optionally, redirect to login or home page
                    setTimeout(() => navigate('/login'), 3000); // Redirect to login after 3 seconds
                })
                .catch((error) => {
                    setMessage('Verification failed. Invalid or expired token.');
                });
        } else {
            setMessage('Invalid verification request. No token provided.');
        }
    }, [location, navigate]);

    return (
        <div>
            <h1>Email Verification</h1>
            <p>{message}</p>
        </div>
    );
};

export default VerifyEmail;

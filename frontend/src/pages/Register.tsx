import React, { useState } from 'react';
import axios from 'axios';

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [message, setMessage] = useState('');

    // Manejo del registro de usuario
    const handleRegisterSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            await axios.post('/api/auth/register', { email, password });
            setMessage('User registered successfully!');
        } catch (error) {
            setMessage('Error registering user.');
        }
    };

    // Manejo del inicio de sesión
    const handleLoginSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            await axios.post('/api/auth/login', { email: loginEmail, password: loginPassword });
            setMessage('Logged in successfully!');
        } catch (error) {
            setMessage('Error logging in.');
        }
    };

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <div className="uk-grid-match uk-child-width-1-2@m" uk-grid="true">
                    {/* Columna de Registro */}
                    <div>
                        <h2>Register</h2>
                        <form onSubmit={handleRegisterSubmit} className="uk-form-stacked">
                            <div className="uk-margin">
                                <label className="uk-form-label" htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    className="uk-input"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="uk-margin">
                                <label className="uk-form-label" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    className="uk-input"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="uk-button uk-button-primary">Register</button>
                        </form>
                    </div>

                    {/* Columna de Login */}
                    <div>
                        <h2>Login</h2>
                        <form onSubmit={handleLoginSubmit} className="uk-form-stacked">
                            <div className="uk-margin">
                                <label className="uk-form-label" htmlFor="loginEmail">Email</label>
                                <input
                                    id="loginEmail"
                                    className="uk-input"
                                    type="email"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="uk-margin">
                                <label className="uk-form-label" htmlFor="loginPassword">Password</label>
                                <input
                                    id="loginPassword"
                                    className="uk-input"
                                    type="password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="uk-button uk-button-secondary">Login</button>
                        </form>
                    </div>
                </div>

                {/* Mensaje de éxito/error */}
                {message && <p>{message}</p>}
            </div>
        </div>
    );
};

export default Register;

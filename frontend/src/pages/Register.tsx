import React, { useState } from 'react';
import api from '../services/api';

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('/auth/register', { email, password, name });
            setMessage(response.data.message);
        } catch (error) {
            setMessage('Error en el registro');
        }
    };

    return (
        <div className="uk-container">
            <h2>Registro de Usuarios</h2>
            <form onSubmit={handleSubmit}>
                <div className="uk-margin">
                    <input
                        className="uk-input"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="uk-margin">
                    <input
                        className="uk-input"
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="uk-margin">
                    <input
                        className="uk-input"
                        type="text"
                        placeholder="Nombre"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <button className="uk-button uk-button-primary" type="submit">Registrarse</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default Register;

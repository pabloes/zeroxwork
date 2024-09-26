import { useState } from 'react';
import {AxiosError} from 'axios';
import UIkit from 'uikit';
import {api} from "../services/axios-setup"; // Asegúrate de tener UIkit instalado

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false); // Estado para el botón de carga
    const [isRegistered, setIsRegistered] = useState(false); // Estado para mostrar el mensaje
    const [message, setMessage] = useState('');

    const handleRegisterSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true); // Activa el estado de carga

        try {
            await api.post('/auth/register', { email, password });
            setIsRegistered(true); // Muestra el mensaje de verificación
        } catch (axiosError:AxiosError|any) {
            const errorMessage = (typeof axiosError?.response?.data?.error === "string" ? axiosError?.response?.data?.error : axiosError?.response?.data?.error?.message) || 'Error registering user.'
            setMessage(errorMessage);
            UIkit.notification({ message: errorMessage, status: 'danger' });
        } finally {
            setIsSubmitting(false); // Desactiva el estado de carga
        }
    };

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                {!isRegistered ? (
                    <form onSubmit={handleRegisterSubmit} className="uk-form-stacked">
                        <h2>Register</h2>
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
                        <button
                            type="submit"
                            className={`uk-button uk-button-primary ${isSubmitting ? 'uk-disabled' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Registering...' : 'Register'}
                        </button>
                    </form>
                ) : (
                    <div className="uk-alert-success" uk-alert="true">
                        <p>Thank you for registering! Please check your email to verify your account.</p>
                    </div>
                )}
                {message && <p>{message}</p>}
            </div>
        </div>
    );
};

export default Register;

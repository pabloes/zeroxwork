import { useState } from 'react';
import UIkit from 'uikit';
import {useAuth} from "../context/AuthContext"; // Ensure UIkit is installed

const Login: React.FC = () => {
    const { login, isAuthenticated } = useAuth(); // Get the login function from the AuthContext
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false); // Loading state
    const [message, setMessage] = useState('');

    const handleLoginSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true); // Activate loading state

        try {
            // Use the login function from useAuth context
            await login(email, password);
            window.location.href = '/';
        } catch (error: any) {
            const errorMessage = error?.response?.data?.error || 'Error logging in.';
            setMessage(errorMessage);
            UIkit.notification({ message: errorMessage, status: 'danger' });
        } finally {
            setIsSubmitting(false); // Deactivate loading state
        }
    };

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <form onSubmit={handleLoginSubmit} className="uk-form-stacked">
                    <h2>Login</h2>
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
                        {isSubmitting ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                {message && <p className="uk-text-danger">{message}</p>}
            </div>
        </div>
    );
};

export default Login;

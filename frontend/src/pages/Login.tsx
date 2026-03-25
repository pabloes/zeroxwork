import { useState } from 'react';
import UIkit from 'uikit';
import {useAuth} from "../context/AuthContext";
import {api} from "../services/axios-setup";
import {Link} from "react-router-dom"; // Ensure UIkit is installed

const Login: React.FC = () => {
    const { login } = useAuth(); // Get the login function from the AuthContext
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [resendToken, setResendToken] = useState<string | null>(null);
    const [sendingVerification, setSendingVerification] = useState(false);

    const handleLoginSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        setResendToken(null);

        try {
            await login(email, password);
            window.location.href = '/';
        } catch (error: any) {
            if (error.response?.data?.resendToken) {
                setResendToken(error.response.data.resendToken);
            }
            const errorMessage = error?.response?.data?.error || 'Error logging in.';
            setMessage(errorMessage);
            UIkit.notification({ message: errorMessage, status: 'danger' });
        } finally {
            setIsSubmitting(false);
        }
    };

    async function sendVerificationMailAgain(){
        if (!resendToken) return;
        setSendingVerification(true);
        try {
            await api.post('/auth/send-verification-mail', { resendToken });
            UIkit.notification({ message: 'Verification mail sent', status: 'success' });
        } catch (error: any) {
            const msg = error?.response?.data?.message || 'Failed to send verification mail';
            UIkit.notification({ message: msg, status: 'danger' });
        }
    }

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
                            type="text"
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
                {resendToken && !sendingVerification ? <a onClick={sendVerificationMailAgain} style={{cursor:'pointer'}}>Send verification mail again</a> :null}
                {message.indexOf("not exist") >= 0 ? <Link to={"/register"}>Register a new account</Link> :null}
            </div>
        </div>
    );
};

export default Login;

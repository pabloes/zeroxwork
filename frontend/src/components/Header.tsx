import { Link } from 'react-router-dom';
import logo from '../../public/zerox-logo.png';
import { useAuth } from "../context/AuthContext";

const Header: React.FC = () => {
    const { user, isAuthenticated, logout } = useAuth(); // Get logout function from context

    const handleLogout = () => {
        logout(); // Call the logout function
        window.location.href = '/'; // Redirect to homepage or any other page after logout
    };

    return (
        <header className="uk-background-muted uk-padding">
            <nav className="uk-navbar-container uk-navbar-transparent" uk-navbar="true">
                <div className="uk-navbar-left">
                    <a href="/" className="uk-navbar-item uk-logo">
                        <img src={logo} alt="ZEROxWORK Logo" width="120" /> {/* Use imported logo */}
                    </a>
                </div>
                <div className="uk-navbar-right">
                    <ul className="uk-navbar-nav">
                        {isAuthenticated ? (
                            <>
                                <li><Link to="/profile">My Account</Link></li>
                                {/* Replace the logout link with a button */}
                                <li>
                                    <a
                                        className="uk-button uk-button-link uk-text-danger"
                                        onClick={handleLogout}
                                    >
                                        Logout
                                    </a>
                                </li>
                            </>
                        ) : (
                            <>
                                <li><Link to="/register">Register</Link></li>
                                <li><Link to="/login">Login</Link></li>
                            </>
                        )}
                    </ul>
                </div>
            </nav>
        </header>
    );
};

export default Header;

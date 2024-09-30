import { Link } from 'react-router-dom';
import logo from '../../public/zeroxwork-logo.png';
import { useAuth } from "../context/AuthContext";

const Header: React.FC = () => {
    const { isAuthenticated, logout, contextTitle } = useAuth(); // Get logout function from context

    const handleLogout = () => {
        logout(); // Call the logout function
        window.location.href = '/'; // Redirect to homepage or any other page after logout
    };

    return (
        <header className="uk-background-muted uk-padding-small">
            <nav className="uk-navbar-container uk-navbar" uk-navbar="true">
                <div className="uk-navbar-left">
                    {/* Logo with link */}
                    <a href="/" className="uk-navbar-item uk-logo">
                        <img src={logo} alt="ZEROxWORK Logo" width="120" /> {/* Use imported logo */}
                    </a>
                </div>

                {/* Center Title */}
                <div className="uk-navbar-center">
                    <h1 className="uk-visible@m">{contextTitle}</h1> {/* Hide title on mobile */}
                </div>

                {/* Right Side with Account Links */}
                <div className="uk-navbar-right">
                    <ul className="uk-navbar-nav">
                        {isAuthenticated ? (
                            <>
                                {/* Dropdown for authenticated users */}
                                <li>
                                    <a href="#">👤 My Account</a>
                                    <div className="uk-navbar-dropdown">
                                        <ul className="uk-nav uk-navbar-dropdown-nav">
                                            <li><Link to="/my-articles">📝 My Articles</Link></li>
                                            <li><Link to="/my-images">🖼️ My Images</Link></li> {/* New Links */}
                                            <li className="uk-nav-divider"></li>
                                            <li><Link to="/account">⚙️ Settings</Link></li>
                                            <li className="uk-nav-divider"></li>
                                            <li>
                                                <a onClick={handleLogout} className="uk-text-danger">
                                                    ⏏️ Logout
                                                </a>
                                            </li>
                                        </ul>
                                    </div>
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

            {/* Page title on mobile view */}
            <div className="uk-hidden@m uk-text-center uk-margin-small-top">
                <h2>{contextTitle}</h2>
            </div>
        </header>
    );
};

export default Header;

import { Link, useLocation } from 'react-router-dom';
import logo from '../../public/zeroxwork-logo.png';
import { useAuth } from "../context/AuthContext";

const Header: React.FC = () => {
    const { isAuthenticated, logout } = useAuth();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        window.location.href = '/';
    };

    // Determine active tab based on current path
    const isActive = (path: string) => {
        if (path === '/blog') {
            return location.pathname === '/' || location.pathname.startsWith('/blog') ||
                   location.pathname.startsWith('/view-article') || location.pathname.startsWith('/articles');
        }
        return location.pathname.startsWith(path);
    };

    return (
        <header className="uk-background-muted uk-padding-small">
            <nav className="uk-navbar-container uk-navbar" uk-navbar="true">
                <div className="uk-navbar-left">
                    {/* Logo with link */}
                    <a href="/" className="uk-navbar-item uk-logo">
                        <img src={logo} alt="ZEROxWORK Logo" width="120" />
                    </a>
                </div>

                {/* Center Navigation Tabs */}
                <div className="uk-navbar-center">
                    <ul className="uk-navbar-nav">
                        <li className={isActive('/blog') ? 'uk-active' : ''}>
                            <Link to="/">Blog</Link>
                        </li>
                        <li className={isActive('/tools') ? 'uk-active' : ''}>
                            <Link to="/tools">Tools</Link>
                        </li>
                    </ul>
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
        </header>
    );
};

export default Header;

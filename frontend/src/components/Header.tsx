import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../../public/zerox-logo.png'; // Importar el logo

const Header: React.FC = () => {
    const isLoggedIn = false; // Cambia esto por la lógica real de autenticación

    return (
        <header className="uk-background-muted uk-padding">
            <nav className="uk-navbar-container uk-navbar-transparent" uk-navbar="true">
                <div className="uk-navbar-left">
                    <a href="/" className="uk-navbar-item uk-logo">
                        <img src={logo} alt="ZEROxWORK Logo" width="120" /> {/* Usar la imagen importada */}
                    </a>
                </div>
                <div className="uk-navbar-right">
                    <ul className="uk-navbar-nav">
                        {isLoggedIn ? (
                            <>
                                <li><Link to="/profile">My Account</Link></li>
                                <li><Link to="/logout">Logout</Link></li>
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

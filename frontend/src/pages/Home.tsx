import React from 'react';
import { Link } from 'react-router-dom';
import Header from "../components/Header";


const Home: React.FC = () => {
/*
    const isLoggedIn = false; // Cambia esto por la lógica real de autenticación
*/

    return (
        <>
            <div className="uk-section uk-section-large uk-text-center">

                <div className="uk-container uk-text-center">
                    <Link to={"/brain-wallet"}>🧠 Brain wallet generator</Link>
                </div>
                <br/>
                <div className="uk-container uk-text-center">
                    <Link to={"/image-upload"}>🏞️ Public Image upload</Link>
                </div>
                <br/>
          {/*      <div className="uk-container">
                    <h1 className="uk-heading-line"><span>Deploy your server in easy steps!</span></h1>
                    <p>With our service, you can deploy and publish your server, fully synced with your GitHub repository, in just a few clicks.</p>
                    {isLoggedIn ? (
                        <Link to="/manage-servers" className="uk-button uk-button-primary">Manage Your Servers</Link>
                    ) : (
                        <Link to="/register" className="uk-button uk-button-primary">Register for Free</Link>
                    )}
                </div>*/}
            </div>
        </>
    );
};

export default Home;

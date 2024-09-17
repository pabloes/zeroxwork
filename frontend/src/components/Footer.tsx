import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="uk-background-secondary uk-light uk-padding">
            <div className="uk-container uk-text-center">
                <p>Follow us on:</p>
                <a href="https://twitter.com" className="uk-icon-button uk-margin-small-right" uk-icon="twitter"></a>
                <a href="https://facebook.com" className="uk-icon-button uk-margin-small-right" uk-icon="facebook"></a>
                <a href="https://instagram.com" className="uk-icon-button" uk-icon="instagram"></a>
                <p>© 2024 MyApp. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer;

import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="uk-background-secondary uk-light uk-padding">
            <div className="uk-container uk-text-center">
                <div>
                    <span className="uk-align-left">
                    Follow us on: <a href="https://twitter.com/zeroxwork" className="uk-icon-button uk-margin-small-right" uk-icon="twitter"></a>
{/*
                    <a href="https://instagram.com" className="uk-icon-button" uk-icon="instagram"></a>
*/}
                        </span>
                    <span className="uk-align-right">© 2024 ZEROxWORK. All rights reserved. | <a href="/terms">Terms and Conditions</a> | <a href="/privacy">Privacy Policy</a></span>

                </div>


            </div>
        </footer>
    );
};

export default Footer;

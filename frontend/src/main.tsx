import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import UIkit CSS and JS
import 'uikit/dist/js/uikit.min.js';
import 'uikit/dist/js/uikit-icons.min.js';
import './styles/main.scss';


ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);

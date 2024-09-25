import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from './wagmi-config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Import UIkit CSS and JS
import 'uikit/dist/js/uikit.min.js';
import 'uikit/dist/js/uikit-icons.min.js';
import './styles/main.scss';
import 'primeicons/primeicons.css';
import { PrimeReactProvider } from 'primereact/api';
import 'primeflex/primeflex.css';
import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <PrimeReactProvider>
                <App />
                </PrimeReactProvider>
            </QueryClientProvider>
        </WagmiProvider>
    </React.StrictMode>,
);

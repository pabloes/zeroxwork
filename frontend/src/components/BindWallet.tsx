import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import axios from 'axios';
import {api} from "../services/axios-setup";

const BindWallet: React.FC = () => {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { signMessage, data, isLoading, isError } = useSignMessage();

    const [message] = useState(`Timestamp:${Date.now()}:Binding wallet`);

    // Efecto para detectar cambios en `data` y ejecutar la lógica correspondiente
    useEffect(() => {
        if (data) {
            bindWallet(data);
        }
    }, [data]);

    // Efecto para manejar errores de la firma
    useEffect(() => {
        if (isError) {
            console.error('Error signing message');
        }
    }, [isError]);

    const handleSignMessage = async () => {
        try {
            await signMessage({ message });
        } catch (error) {
            console.error('Error initiating signature:', error);
        }
    };

    const bindWallet = async (signature: string) => {
        try {
            await api.post('wallet/bind', {
                userId: 1, // ID del usuario logueado
                address,
                signature,
                message,
            });
            alert('Wallet bound successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to bind wallet');
        }
    };

    return (
        <div>
            {!isConnected ? (
                <button onClick={() => connect({ connector: connectors[0] })}>
                    Connect Wallet
                </button>
            ) : (
                <>
                    <p>Connected as {address}</p>
                    <button onClick={handleSignMessage} disabled={isLoading}>
                        {isLoading ? 'Signing...' : 'Bind Wallet'}
                    </button>
                    <button onClick={() => disconnect()}>Disconnect</button>
                </>
            )}
        </div>
    );
};

export default BindWallet;

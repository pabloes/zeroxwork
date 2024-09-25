import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { api } from '../services/axios-setup';

const BindWallet: React.FC = () => {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { signMessage, data, isLoading, isError } = useSignMessage();

    const [message] = useState(`Timestamp:${Date.now()}:Binding wallet`);
    const [wallets, setWallets] = useState<any[]>([]); // Estado para las wallets vinculadas

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

    // Efecto para obtener las wallets vinculadas cuando el usuario se conecta
    useEffect(() => {
        if (isConnected) {
            fetchWallets();
        }
    }, [isConnected]);

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
                userId: 1, // ID del usuario logueado, cámbialo según sea necesario
                address,
                signature,
                message,
            });
            alert('Wallet bound successfully!');
            fetchWallets(); // Actualiza la lista de wallets después de vincular
        } catch (error) {
            console.error(error);
            alert('Failed to bind wallet');
        }
    };

    // Función para obtener las wallets vinculadas al usuario
    const fetchWallets = async () => {
        try {
            const response = await api.get('/wallet/wallets'); // Solicitud al endpoint para obtener las wallets
            setWallets(response.data);
        } catch (error) {
            console.error('Error fetching wallets:', error);
        }
    };

    return (
        <div className="uk-container uk-margin-top">
            {!isConnected ? (
                <button
                    className="uk-button uk-button-primary uk-margin-small-right"
                    onClick={() => connect({ connector: connectors[0] })}
                >
                    Connect Wallet
                </button>
            ) : (
                <>
                    <div className="uk-card uk-card-default uk-card-body uk-margin-top">
                        <h3 className="uk-card-title">Account Details</h3>
                        <p>
                            Connected as <span className="uk-label">{address}</span>
                        </p>
                        <button
                            className="uk-button uk-button-secondary uk-margin-small-right"
                            onClick={handleSignMessage}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing...' : 'Bind Wallet'}
                        </button>
                        <button className="uk-button uk-button-danger" onClick={() => disconnect()}>
                            Disconnect
                        </button>
                    </div>

                    <div className="uk-card uk-card-default uk-card-body uk-margin-top">
                        <h3 className="uk-card-title">Linked Wallets</h3>
                        {wallets.length > 0 ? (
                            <ul className="uk-list uk-list-divider">
                                {wallets.map((wallet) => (
                                    <li key={wallet.id}>
                                        <span className="uk-label uk-label-success">{wallet.address}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No wallets linked yet.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default BindWallet;

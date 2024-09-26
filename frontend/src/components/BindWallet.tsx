import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { api } from '../services/axios-setup';
import 'uikit/dist/css/uikit.min.css';

const BindWallet: React.FC = () => {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { signMessage, data, isLoading, isError } = useSignMessage();

    const [message] = useState(`Timestamp:${Date.now()}:Binding wallet`);
    const [wallets, setWallets] = useState<any[]>([]); // Estado para las wallets vinculadas

    useEffect(() => {
        if (data) {
            bindWallet(data);
        }
    }, [data]);

    useEffect(() => {
        if (isError) {
            console.error('Error signing message');
        }
    }, [isError]);

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
                                {wallets?.map((wallet) => (
                                    <li key={wallet.id}>
                                        <span className="uk-label uk-label-success">{wallet.address}</span>
                                        <p>
                                            Decentraland names: {wallet.walletDecentralandNames?.map((name) => (
                                            <><span key={name.id} className="uk-badge">
                                            {name.name}
                                            </span><span>&nbsp;</span></>
                                        ))}
                                        </p>
                                        <ul className="uk-list">

                                            {wallet.walletDecentralandNames?.map((name) => (
                                                <li key={name.id}>

                                                </li>
                                            ))}
                                        </ul>
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

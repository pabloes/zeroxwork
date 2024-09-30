import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { api } from '../services/axios-setup';
import 'uikit/dist/css/uikit.min.css';
import UIkit from 'uikit';
import { useQuery } from '@tanstack/react-query'; // Import React Query

interface BindWalletProps {
    onAddWallet: () => void;
    onRemoveWallet: () => void;
}

const BindWallet: React.FC<BindWalletProps> = ({ onAddWallet, onRemoveWallet }) => {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { signMessage, data, isPending } = useSignMessage();
    const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
    const [defaultIdentity, setDefaultIdentity] = useState<number | null>(null); // Store selected identity
    const [selectedName, setSelectedName] = useState<string | null>(null); // Store selected name

    // Fetch user information (default name, etc.)
    const { data: userInfo, isLoading: isLoadingUserInfo } = useQuery({
        queryKey: ['userInfo'],
        queryFn: async () => {
            const response = await api.get('/user/me'); // Fetch the user info from your backend
            return response.data;
        },
        enabled: isConnected,
    });

    // Fetch wallets using useQuery
    const { data: wallets, isLoading: isLoadingWallets, refetch: refetchWallets } = useQuery({
        queryKey: ['wallets'],
        queryFn: async () => {
            const response = await api.get('/wallet/wallets');
            return response.data;
        },
        enabled: isConnected,
    });

    // Set the default name and wallet when user info is available
    useEffect(() => {
        if (userInfo?.defaultName) {
            setDefaultIdentity(userInfo.defaultName.id); // Set the default identity from user info
            setSelectedName(userInfo.defaultName.name); // Set the default name
            setSelectedWallet(userInfo.defaultName.walletAddress); // Set the wallet linked to the default name
        }
    }, [userInfo]);

    // Fetch avatar for the selected wallet (directly as image URL)
    const avatarUrl = selectedWallet ? `/api/user/decentraland-avatar/${selectedWallet}` : null;

    // Bind wallet once the signature is available
    useEffect(() => {
        if (data) {
            bindWallet(data);
        }
    }, [data]);

    const handleSignMessage = async () => {
        try {
            await signMessage({ message: 'Binding wallet' });
        } catch (error) {
            console.error('Error signing message:', error);
        }
    };

    const bindWallet = async (signature: string) => {
        try {
            await api.post('wallet/bind', {
                userId: 1, // ID del usuario logueado
                address,
                signature,
                message: 'Binding wallet',
            });
            await UIkit.notification('Wallet bound successfully!');
            refetchWallets(); // Refetch wallets after binding
            if (onAddWallet) onAddWallet();
        } catch (error) {
            console.error('Failed to bind wallet', error);
            UIkit.notification('Failed to bind wallet', { status: 'danger' });
        }
    };

    const handleWalletSelect = (walletAddress: string) => {
        setSelectedWallet(walletAddress); // Set the selected wallet
    };

    const setDefaultName = async (nameId: number, name: string, walletAddress: string) => {
        try {
            // Save the selected default name to the backend
            await api.post('/user/set-default-name', { nameId });

            // Update the local state to reflect the new default name and wallet
            setDefaultIdentity(nameId);
            setSelectedName(name); // Update selected name
            setSelectedWallet(walletAddress); // Update wallet

            UIkit.notification('Default digital identity set successfully!', { status: 'success' });
        } catch (error) {
            console.error('Failed to set default name', error);
            UIkit.notification('Failed to set default digital identity', { status: 'danger' });
        }
    };

    return (
        <div className="uk-container">
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
                        <p>Connected as <span className="uk-label">{address}</span></p>
                        <button
                            className="uk-button uk-button-secondary uk-margin-small-right"
                            onClick={handleSignMessage}
                            disabled={isPending}
                        >
                            {isPending ? 'Signing...' : 'Bind Wallet'}
                        </button>
                        <button className="uk-button uk-button-danger" onClick={() => disconnect()}>
                            Disconnect
                        </button>
                    </div>

                    <div className="uk-card uk-card-default uk-card-body uk-margin-top">
                        <h3 className="uk-card-title">Linked Wallets</h3>
                        {isLoadingWallets ? (
                            <p>Loading wallets...</p>
                        ) : (
                            <ul className="uk-list uk-list-divider">
                                {wallets?.map((wallet: any) => (
                                    <li key={wallet.id} onClick={() => handleWalletSelect(wallet.address)}>
                                        <span className="uk-label uk-label-success">{wallet.address}</span>&nbsp;
                                        <p>
                                            <label>Select Decentraland Digital Identity</label>: {wallet.walletDecentralandNames?.map((nameNFT: any) => (
                                            <button
                                                key={nameNFT.id}
                                                className={`uk-button ${nameNFT.id === defaultIdentity ? 'uk-button-primary' : 'uk-button-default'}`}
                                                onClick={() => setDefaultName(nameNFT.id, nameNFT.name, wallet.address)}
                                                style={{ cursor: 'pointer', marginRight: '5px' }}
                                            >
                                                {nameNFT.name}
                                            </button>
                                        ))}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Display the Decentraland avatar and selected name */}
                    {selectedWallet && (
                        <div className="uk-card uk-card-default uk-card-body uk-margin-top">
                            <h3 className="uk-card-title">Digital Identity</h3>
                            <div className="uk-flex uk-flex-middle">
                                {/* Avatar image */}
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt="Decentraland Avatar"
                                        className="uk-border-circle"
                                        style={{ width: '100px', height: '100px' }}
                                    />
                                ) : (
                                    <p>No avatar available</p>
                                )}
                                {/* Selected name */}
                                <h2 className="uk-margin-left">{selectedName || 'No name selected'}</h2>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default BindWallet;

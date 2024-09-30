import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { api } from '../services/axios-setup';
import 'uikit/dist/css/uikit.min.css';
import ConfirmActionModal from "./ConfirmActionModal";
import UIkit from "uikit";
// Define props interface
interface BindWalletProps {
    onAddWallet: () => void;
    onRemoveWallet: () => void;
}

const BindWallet: React.FC<BindWalletProps> = ({ onAddWallet, onRemoveWallet }) => {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { signMessage, data, isPending, isError } = useSignMessage();
    const [showDeleteWalletModal, setShowDeleteWalletModal] = useState<boolean>(false);
    const [walletToDelete, setWalletToDelete] = useState<any | null>(null); // Cambiar a objeto para almacenar la imagen completa
    const [error, setError] = useState<string | null>(null);
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
    const handleDeleteWallet = async (address: string) => {
        try {
            await api.delete(`/wallet/${address}`);
            setWallets((prevImages) => prevImages.filter((wallet) => wallet.address !== address));
            UIkit.notification({ message: `Wallet removed`, status: 'success' });
            if(onRemoveWallet) onRemoveWallet();
        } catch (err) {
            setError('Failed to remove wallet.');
        }
    };
    const closeDeleteModal = () => {
        setShowDeleteWalletModal(false);
        setWalletToDelete(null);
    };

    const openDeleteWalletModal = (wallet: any) => {
        setWalletToDelete(wallet); // Almacenar el objeto de la imagen completa
        setShowDeleteWalletModal(true);
    };
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
            await UIkit.notification('Wallet bound successfully!');
            await fetchWallets(); // Actualiza la lista de wallets después de vincular
            if(onAddWallet) onAddWallet();
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
        <div className="uk-container ">
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
                        {wallets.length > 0 ? (
                            <ul className="uk-list uk-list-divider">
                                {wallets?.map((wallet) => (
                                    <li key={wallet.id}>
                                        <span className="uk-label uk-label-success">{wallet.address}</span>&nbsp;
                                        <button className="uk-icon-button uk-border-circle uk-button-danger" uk-icon={'trash'} onClick={()=>openDeleteWalletModal(wallet)}></button>
                                        <ConfirmActionModal
                                            show={showDeleteWalletModal}
                                            onClose={closeDeleteModal}
                                            onConfirm={() => {
                                                if (walletToDelete) {
                                                    handleDeleteWallet(walletToDelete.address);
                                                }
                                            }}
                                            title="Confirm Removal"
                                            message="Are you sure you want to remove this wallet?"
                                            confirmButtonText="Delete"
                                            cancelButtonText="Cancel"
                                            wordToType="remove"
                                        />
                                        <p>
                                            Decentraland names: {wallet.walletDecentralandNames?.map((nameNFT:any) => (
                                            <span key={nameNFT.id}>
                                                <span className="uk-badge">{nameNFT.name}</span>
                                                <span>&nbsp;</span>
                                            </span>
                                        ))}
                                        </p>

                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No wallets linked yet.</p>
                        )}
                    </div>
                    {error && <p style={{color:"red"}}>{error}</p>}
                </>
            )}
        </div>
    );
};

export default BindWallet;

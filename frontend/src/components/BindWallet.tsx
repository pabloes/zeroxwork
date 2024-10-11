import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { api } from '../services/axios-setup';
import 'uikit/dist/css/uikit.min.css';
import UIkit from 'uikit';
import ConfirmActionModal from './ConfirmActionModal'; // Import the confirmation modal
import { useQuery } from '@tanstack/react-query';
import {OnchainKitProvider} from "@coinbase/onchainkit";
import {base} from "viem/chains";
import {Avatar, Identity} from "@coinbase/onchainkit/identity"; // Import React Query

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
    const [showDeleteWalletModal, setShowDeleteWalletModal] = useState<boolean>(false);
    const [walletToDelete, setWalletToDelete] = useState<any | null>(null); // Wallet to be deleted

    // Fetch user information (default name, etc.)
    const { data: userInfo } = useQuery({
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

    const openDeleteWalletModal = (wallet: any) => {
        setWalletToDelete(wallet);
        setShowDeleteWalletModal(true);
    };

    const closeDeleteWalletModal = () => {
        setShowDeleteWalletModal(false);
        setWalletToDelete(null);
    };

    const handleDeleteWallet = async (walletAddress: string) => {
        try {
            await api.delete(`/wallet/${walletAddress}`);

            // If the deleted wallet is the current selected wallet, clear the digital identity
            if (walletAddress === selectedWallet) {
                setSelectedWallet(null);
                setSelectedName(null);
                setDefaultIdentity(null);
            }

            refetchWallets(); // Refetch the wallets after deletion
            UIkit.notification('Wallet removed successfully!', { status: 'success' });
            if (onRemoveWallet) onRemoveWallet();
        } catch (error) {
            console.error('Failed to remove wallet', error);
            UIkit.notification('Failed to remove wallet', { status: 'danger' });
        }
        closeDeleteWalletModal(); // Close the confirmation modal
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
                        <h3 className="uk-card-title">Linked Wallets with names</h3>
                        {isLoadingWallets ? (
                            <p>Loading wallets...</p>
                        ) : (
                            <ul className="uk-list uk-list-divider">
                                {wallets?.map((wallet: any) => (
                                    <li key={wallet.id}>
                                        <span className="uk-label uk-label-success">{wallet.address}</span>
                                        <button
                                            className="uk-icon-button uk-border-circle uk-button-danger uk-margin-left"
                                            uk-icon="trash"
                                            onClick={() => openDeleteWalletModal(wallet)}
                                        ></button>
                                        <p>
                                            <div className="uk-card uk-card-default">
                                                <label><b>Select Digital Identity Name:</b></label>
                                                <br/><br/>
                                                <div className="uk-card uk-card-default">
                                                    <b >Decentraland names:</b>
                                                    {wallet.walletNames?.filter(w=>w.subdomain==="dcl").map((nameNFT: any) => (
                                                    <button
                                                        key={nameNFT.id}
                                                        className={`uk-button ${nameNFT.id === defaultIdentity ? 'uk-button-primary' : 'uk-button-default'}`}
                                                        onClick={() => setDefaultName(nameNFT.id, nameNFT.name, wallet.address)}
                                                        style={{ cursor: 'pointer', marginRight: '5px' }}
                                                    >
                                                        {nameNFT.name}
                                                    </button>
                                                    ))}
                                                    {wallet.walletNames?.filter(w=>w.subdomain==="dcl").length === 0 && <span> No Decentraland name found, get your name at <a href={"https://decentraland.org/marketplace/names/claim"}>https://decentraland.org/marketplace/names/claim</a></span>}
                                                </div>
                                                <br/>
                                                <div className="uk-card uk-card-default">
                                                    <b>Basenames:</b> {wallet.walletNames?.filter(w => w.subdomain === "base").map((nameNFT: any) => (
                                                    <button
                                                        key={nameNFT.id}
                                                        className={`uk-button ${nameNFT.id === defaultIdentity ? 'uk-button-primary' : 'uk-button-default'}`}
                                                        onClick={() => setDefaultName(nameNFT.id, nameNFT.name, wallet.address)}
                                                        style={{cursor: 'pointer', marginRight: '5px'}}
                                                    >
                                                        {nameNFT.name}
                                                    </button>
                                                ))}
                                                    {wallet.walletNames?.filter(w=>w.subdomain==="dcl").length === 0 && <span> No Basenames found, get your name at <a href={"https://www.base.org/names"}>https://www.base.org/names</a></span>}
                                                </div>
                                            </div>


                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <OnchainKitProvider chain={base}>
                        {/* Display the Decentraland avatar and selected name */}
                        {selectedWallet && selectedName && (
                            <div className="uk-card uk-card-default uk-card-body uk-margin-top uk-flex uk-flex-center uk-padding">
                                <div className="uk-flex uk-flex-middle uk-flex-column uk-text-center">
                                    <h3 className="uk-card-title">Digital Identity</h3>

                                    {selectedName.indexOf(".dcl.") >= 0 && <>
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt="Decentraland Avatar"
                                                className="uk-border-circle"
                                                style={{ width: '150px', height: '150px', marginBottom: '15px', border: '3px solid #e5e5e5' }}
                                            />
                                        ) : (
                                            <p>No avatar available</p>
                                        )}
                                    </>}
                                    {selectedName.indexOf(".base.") >= 0 && <>
                                        <img
                                            src={"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwMCIgaGVpZ2h0PSIzMDAwIiB2aWV3Qm94PSIwIDAgMzAwMCAzMDAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF81NTY5XzcyODA5KSI+PHJlY3Qgd2lkdGg9IjMwMDAiIGhlaWdodD0iMzAwMCIgZmlsbD0iIzE1NURGRCIvPjxjaXJjbGUgY3g9IjE1MDAiIGN5PSIxNTAwIiByPSIxNTAwIiBmaWxsPSIjMTU1REZEIi8+PHBhdGggZD0iTTIxODguMTIgMTEzMS45NUMyNjkxLjExIDU5MS4xODcgMjM1Ni44IDI1Ni45NCAxODE1LjkxIDc1OS44MjZDMTc2Ny41NyA4MDQuODI2IDE3MzcuNTYgODY2LjQ5NCAxNzMzLjMyIDkzMi40MDNDMTczMy4zMiA5MzMuNzY3IDE3MzMuMTcgOTM0Ljk3OSAxNzMzLjAyIDkzNi4zNDNDMTcyMi41NiAxMDk0LjY4IDE4NTMuMzUgMTIyNS40NCAyMDExLjcyIDEyMTQuOThDMjAxMy4wOCAxMjE0Ljk4IDIwMTQuMjkgMTIxNC44MyAyMDE1LjY2IDEyMTQuNjhDMjA4MS41OCAxMjEwLjQ0IDIxNDMuMjYgMTE4MC40NCAyMTg4LjI3IDExMzIuMUwyMTg4LjEyIDExMzEuOTVaIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik03NTkuODc5IDE4MTYuMDVDMjU2Ljg4NSAyMzU2LjgxIDU5MS4yMDQgMjY5MS4wNiAxMTMyLjA4IDIxODguMTdDMTE4MC40MyAyMTQzLjE3IDEyMTAuNDQgMjA4MS41MSAxMjE0LjY4IDIwMTUuNkMxMjE0LjY4IDIwMTQuMjMgMTIxNC44MyAyMDEzLjAyIDEyMTQuOTggMjAxMS42NkMxMjI1LjQ0IDE4NTMuMzIgMTA5NC42NSAxNzIyLjU2IDkzNi4yODMgMTczMy4wMkM5MzQuOTE5IDE3MzMuMDIgOTMzLjcwNiAxNzMzLjE3IDkzMi4zNDIgMTczMy4zMkM4NjYuNDE4IDE3MzcuNTYgODA0LjczOCAxNzY3LjU2IDc1OS43MjcgMTgxNS45TDc1OS44NzkgMTgxNi4wNVoiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTExMzEuOTYgNzU5LjkyMkM1OTEuMjQ3IDI1Ni44MjYgMjU2Ljg4MSA1OTEuMjY0IDc1OS44NjkgMTEzMi4wOUM4MDQuODY1IDExODAuNDMgODY2LjUyNyAxMjEwLjQ0IDkzMi40MzEgMTIxNC42OEM5MzMuNzk0IDEyMTQuNjggOTM1LjAwNiAxMjE0LjgzIDkzNi4zNyAxMjE0Ljk4QzEwOTQuNjkgMTIyNS40NCAxMjI1LjQ0IDEwOTQuNjYgMTIxNC45OCA5MzYuMzA5QzEyMTQuOTggOTM0Ljk0NiAxMjE0LjgzIDkzMy43MzMgMTIxNC42OCA5MzIuMzY5QzEyMTAuNDQgODY2LjQ1MiAxMTgwLjQ0IDgwNC43NzcgMTEzMi4xMSA3NTkuNzcxTDExMzEuOTYgNzU5LjkyMloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTE4MTYuMDUgMjE4OC4xMkMyMzU2LjgxIDI2OTEuMTEgMjY5MS4wNiAyMzU2LjggMjE4OC4xNyAxODE1LjkxQzIxNDMuMTcgMTc2Ny41NyAyMDgxLjUxIDE3MzcuNTYgMjAxNS42IDE3MzMuMzJDMjAxNC4yMyAxNzMzLjMyIDIwMTMuMDIgMTczMy4xNyAyMDExLjY2IDE3MzMuMDJDMTg1My4zMiAxNzIyLjU2IDE3MjIuNTYgMTg1My4zNSAxNzMzLjAyIDIwMTEuNzJDMTczMy4wMiAyMDEzLjA4IDE3MzMuMTcgMjAxNC4yOSAxNzMzLjMyIDIwMTUuNjZDMTczNy41NiAyMDgxLjU4IDE3NjcuNTYgMjE0My4yNiAxODE1LjkgMjE4OC4yN0wxODE2LjA1IDIxODguMTJaIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik0xNzM3LjE4IDcyNy4wMkMxNzEwLjM2IC0xMC4zMzk4IDEyMzcuNjYgLTEwLjMzOTggMTIxMC44NCA3MjcuMDJDMTIwOC40MiA3OTIuODY5IDEyMzAuODQgODU3LjY1OCAxMjc0LjQ4IDkwNy4zMUMxMjc1LjM5IDkwOC4zNyAxMjc2LjE0IDkwOS4yNzggMTI3Ny4wNSA5MTAuMzM4QzEzODEuNTkgMTAyOS42MiAxNTY2LjQzIDEwMjkuNjIgMTY3MC45NyA5MTAuMzM4QzE2NzEuODggOTA5LjI3OCAxNjcyLjYzIDkwOC4zNyAxNjczLjU0IDkwNy4zMUMxNzE3LjE4IDg1Ny44MSAxNzM5LjQ1IDc5My4wMiAxNzM3LjE4IDcyNy4wMloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTcyNy4wMiAxMjEwLjgyQy0xMC4zMzk4IDEyMzcuNjQgLTEwLjMzOTggMTcxMC4zNCA3MjcuMDIgMTczNy4xNkM3OTIuODY5IDE3MzkuNTggODU3LjY1OCAxNzE3LjE2IDkwNy4zMSAxNjczLjUyQzkwOC4yMTggMTY3Mi42MiA5MDkuMjc4IDE2NzEuODYgOTEwLjMzOCAxNjcwLjk1QzEwMjkuNjIgMTU2Ni40MSAxMDI5LjYyIDEzODEuNTcgOTEwLjMzOCAxMjc3LjAzQzkwOS4yNzggMTI3Ni4xMiA5MDguMzcgMTI3NS4zNyA5MDcuMzEgMTI3NC40NkM4NTcuODEgMTIzMC44MiA3OTMuMDIgMTIwOC41NSA3MjcuMDIgMTIxMC44MloiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTIwNDAuNjkgMTI3NC40OEMyMDM5LjYzIDEyNzUuMzkgMjAzOC43MiAxMjc2LjE0IDIwMzcuNjYgMTI3Ny4wNUMxOTE4LjM4IDEzODEuNTkgMTkxOC4zOCAxNTY2LjQzIDIwMzcuNjYgMTY3MC45N0MyMDM4LjcyIDE2NzEuODggMjAzOS42MyAxNjcyLjYzIDIwNDAuNjkgMTY3My41NEMyMDkwLjE5IDE3MTcuMTggMjE1NC45OCAxNzM5LjQ1IDIyMjAuOTggMTczNy4xOEMyOTU4LjM0IDE3MTAuMzYgMjk1OC4zNCAxMjM3LjY2IDIyMjAuOTggMTIxMC44NEMyMTU1LjEzIDEyMDguNDIgMjA5MC4zNCAxMjMwLjg0IDIwNDAuNjkgMTI3NC40OFoiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTEyMTAuODIgMjIyMC45OEMxMjM3LjY0IDI5NTguMzQgMTcxMC4zNCAyOTU4LjM0IDE3MzcuMTYgMjIyMC45OEMxNzM5LjU4IDIxNTUuMTMgMTcxNy4xNiAyMDkwLjM0IDE2NzMuNTIgMjA0MC42OUMxNjcyLjYyIDIwMzkuNjMgMTY3MS44NiAyMDM4LjcyIDE2NzAuOTUgMjAzNy42NkMxNTY2LjQxIDE5MTguMzggMTM4MS41NyAxOTE4LjM4IDEyNzcuMDMgMjAzNy42NkMxMjc2LjEyIDIwMzguNzIgMTI3NS4zNyAyMDM5LjYzIDEyNzQuNDYgMjA0MC42OUMxMjMwLjgyIDIwOTAuMTkgMTIwOC41NSAyMTU0Ljk4IDEyMTAuODIgMjIyMC45OFoiIGZpbGw9IndoaXRlIi8+PGNpcmNsZSBjeD0iMTQ3NC41IiBjeT0iMTQ3NC41IiByPSI4ODYuNSIgZmlsbD0id2hpdGUiLz48cGF0aCBkPSJNMTM5MS4wNiAxNTAwQzEzOTEuMDYgMTM1Mi4xMSAxMzU4LjQgMTIxOC4zOCAxMzA1Ljc0IDExMjEuNzJDMTI1My4wMyAxMDI0Ljk1IDExODAuNjkgOTY2IDExMDEuNTMgOTY2QzEwMjIuMzYgOTY2IDk1MC4wMzEgMTAyNC45NSA4OTcuMzE0IDExMjEuNzJDODQ0LjY2IDEyMTguMzggODEyIDEzNTIuMTEgODEyIDE1MDBDODEyIDE2NDcuODkgODQ0LjY2IDE3ODEuNjIgODk3LjMxNCAxODc4LjI4Qzk1MC4wMzEgMTk3NS4wNSAxMDIyLjM2IDIwMzQgMTEwMS41MyAyMDM0QzExODAuNjkgMjAzNCAxMjUzLjAzIDE5NzUuMDUgMTMwNS43NCAxODc4LjI4QzEzNTguNCAxNzgxLjYyIDEzOTEuMDYgMTY0Ny44OSAxMzkxLjA2IDE1MDBaIiBmaWxsPSIjMTU1REZEIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjYiLz48ZWxsaXBzZSBjeD0iMTI2LjQxNCIgY3k9IjIzMS45MzQiIHJ4PSIxMjYuNDE0IiByeT0iMjMxLjkzNCIgdHJhbnNmb3JtPSJtYXRyaXgoMSAwIDAgLTEgOTc2LjE2IDIwMzcpIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik0yMTg3LjE2IDE1MDBDMjE4Ny4xNiAxMzUyLjExIDIxNTQuNSAxMjE4LjM4IDIxMDEuODQgMTEyMS43MkMyMDQ5LjEyIDEwMjQuOTUgMTk3Ni43OSA5NjYgMTg5Ny42MyA5NjZDMTgxOC40NiA5NjYgMTc0Ni4xMyAxMDI0Ljk1IDE2OTMuNDEgMTEyMS43MkMxNjQwLjc2IDEyMTguMzggMTYwOC4xIDEzNTIuMTEgMTYwOC4xIDE1MDBDMTYwOC4xIDE2NDcuODkgMTY0MC43NiAxNzgxLjYyIDE2OTMuNDEgMTg3OC4yOEMxNzQ2LjEzIDE5NzUuMDUgMTgxOC40NiAyMDM0IDE4OTcuNjMgMjAzNEMxOTc2Ljc5IDIwMzQgMjA0OS4xMiAxOTc1LjA1IDIxMDEuODQgMTg3OC4yOEMyMTU0LjUgMTc4MS42MiAyMTg3LjE2IDE2NDcuODkgMjE4Ny4xNiAxNTAwWiIgZmlsbD0iIzE1NURGRCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI2Ii8+PGVsbGlwc2UgY3g9IjEyNi40MTQiIGN5PSIyMzEuOTM0IiByeD0iMTI2LjQxNCIgcnk9IjIzMS45MzQiIHRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDE3NzAuMTcgMjAzNykiIGZpbGw9IndoaXRlIi8+PC9nPjxkZWZzPjxjbGlwUGF0aCBpZD0iY2xpcDBfNTU2OV83MjgwOSI+PHJlY3Qgd2lkdGg9IjMwMDAiIGhlaWdodD0iMzAwMCIgZmlsbD0id2hpdGUiLz48L2NsaXBQYXRoPjwvZGVmcz48L3N2Zz4="}
                                            alt="Basename Avatar"
                                            className="uk-border-circle"
                                            style={{ width: '150px', height: '150px', marginBottom: '15px', border: '3px solid #e5e5e5' }}
                                        />
                                    </>}
                                    {/* Selected name */}
                                    <p className="uk-margin-top uk-text-large uk-text-bold">{selectedName}</p>
                                </div>
                            </div>
                        )}

                        {/* Confirmation Modal for Deleting Wallet */}
                        {walletToDelete && (
                            <ConfirmActionModal
                                show={showDeleteWalletModal}
                                onClose={closeDeleteWalletModal}
                                onConfirm={() => handleDeleteWallet(walletToDelete.address)}
                                title="Confirm Wallet Deletion"
                                message="Are you sure you want to delete this wallet? This action cannot be undone."
                                confirmButtonText="Delete"
                                cancelButtonText="Cancel"
                                wordToType="delete"
                            />
                        )}
                    </OnchainKitProvider>

                </>
            )}
        </div>
    );
};

export default BindWallet;

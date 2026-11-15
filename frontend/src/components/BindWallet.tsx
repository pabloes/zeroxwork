import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { api } from '../services/axios-setup';
import UIkit from 'uikit';
import ConfirmActionModal from './ConfirmActionModal';
import { useQuery } from '@tanstack/react-query';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';
import { getNameAvatarImage } from '../services/get-name-avatar-image';
import { useTranslation } from '../i18n';

interface BindWalletProps {
    onAddWallet: () => void;
    onRemoveWallet: () => void;
}

/** Where a name of each kind is bought, for the member who has none yet. */
const WHERE_TO_GET: Record<'dcl' | 'base', string> = {
    dcl: 'https://decentraland.org/marketplace/names/claim',
    base: 'https://www.base.org/names',
};

const BindWallet: React.FC<BindWalletProps> = ({ onAddWallet, onRemoveWallet }) => {
    const { t } = useTranslation();
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { signMessage, data, isPending } = useSignMessage();
    // What the server asked this wallet to sign, kept until the signature is
    // back: the two travel together, and one without the other is refused.
    const proofRef = useRef<{ address: string; expires: number; code: string } | null>(null);
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

    // Bind wallet once the signature is available
    useEffect(() => {
        if (data) {
            bindWallet(data);
        }
    }, [data]);

    const handleSignMessage = async () => {
        if (!address) return;
        try {
            // The server writes the text: it names this account and this wallet
            // and expires in minutes. A fixed text signed once could be reused
            // by anybody, on any account.
            const { data: wanted } = await api.get('/wallet/bind-message', { params: { address } });
            proofRef.current = { address, expires: wanted.expires, code: wanted.code };
            signMessage({ message: wanted.message });
        } catch (error) {
            console.error('Error signing message:', error);
            UIkit.notification(t('account.wallet.bound_error'), { status: 'danger' });
        }
    };

    const bindWallet = async (signature: string) => {
        try {
            const proof = proofRef.current;
            if (!proof) throw new Error('signature without a pending request');
            await api.post('wallet/bind', {
                // the wallet the text was written for, even if another one was
                // selected in the meantime
                address: proof.address,
                signature,
                expires: proof.expires,
                code: proof.code,
            });
            proofRef.current = null;
            UIkit.notification(t('account.wallet.bound_ok'), { status: 'success' });
            refetchWallets(); // Refetch wallets after binding
            if (onAddWallet) onAddWallet();
        } catch (error) {
            console.error('Failed to bind wallet', error);
            UIkit.notification(t('account.wallet.bound_error'), { status: 'danger' });
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

            UIkit.notification(t('account.wallet.name_ok'), { status: 'success' });
        } catch (error) {
            console.error('Failed to set default name', error);
            UIkit.notification(t('account.wallet.name_error'), { status: 'danger' });
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
            UIkit.notification(t('account.wallet.removed_ok'), { status: 'success' });
            if (onRemoveWallet) onRemoveWallet();
        } catch (error) {
            console.error('Failed to remove wallet', error);
            UIkit.notification(t('account.wallet.removed_error'), { status: 'danger' });
        }
        closeDeleteWalletModal(); // Close the confirmation modal
    };

    /**
     * The names of one kind on a wallet, each a button that makes it the public
     * name. With none, where to get one -- which is the only useful thing to
     * say to somebody who has just linked an empty wallet.
     */
    const nameGroup = (wallet: any, kind: 'dcl' | 'base') => {
        const names = (wallet.walletNames ?? []).filter((name: any) => name.subdomain === kind);
        const label = kind === 'dcl' ? t('account.wallet.dcl_names') : t('account.wallet.base_names');

        return (
            <div className="zx-wallet-names">
                <span className="zx-wallet-kind">{label}</span>
                {names.length === 0 ? (
                    <p className="zx-profile-hint">
                        {kind === 'dcl' ? t('account.wallet.no_dcl') : t('account.wallet.no_base')}{' '}
                        <a href={WHERE_TO_GET[kind]} target="_blank" rel="noreferrer">
                            {t('account.wallet.get_name')} →
                        </a>
                    </p>
                ) : (
                    <div className="zx-wallet-chips">
                        {names.map((nameNFT: any) => {
                            const inUse = nameNFT.id === defaultIdentity;
                            return (
                                <button
                                    key={nameNFT.id}
                                    type="button"
                                    className={`zx-chip${inUse ? ' is-on' : ''}`}
                                    aria-pressed={inUse}
                                    onClick={() => setDefaultName(nameNFT.id, nameNFT.name, wallet.address)}
                                >
                                    {nameNFT.name}
                                    {inUse && <span className="zx-chip-note">{t('account.wallet.in_use')}</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <section className="zx-panel">
            <h3 className="zx-panel-title">{t('account.wallet.title')}</h3>
            <p className="zx-panel-sub">{t('account.wallet.sub')}</p>

            {!isConnected ? (
                <button
                    type="button"
                    className="zx-btn zx-btn-primary"
                    onClick={() => connect({ connector: connectors[0] })}
                >
                    {t('account.wallet.connect')}
                </button>
            ) : (
                <OnchainKitProvider chain={base as any}>
                    <div className="zx-wallet-current">
                        <p className="zx-profile-hint">
                            {t('account.wallet.connected_as')} <span className="zx-wallet-address">{address}</span>
                        </p>
                        <div className="zx-profile-actions">
                            <button
                                type="button"
                                className="zx-btn zx-btn-primary"
                                onClick={handleSignMessage}
                                disabled={isPending}
                            >
                                {isPending ? t('account.wallet.signing') : t('account.wallet.bind')}
                            </button>
                            <button type="button" className="zx-btn zx-btn-ghost" onClick={() => disconnect()}>
                                {t('account.wallet.disconnect')}
                            </button>
                        </div>
                    </div>

                    <h4 className="zx-security-form-title">{t('account.wallet.linked_title')}</h4>

                    {isLoadingWallets && <p className="zx-profile-hint">{t('account.wallet.loading')}</p>}
                    {!isLoadingWallets && !wallets?.length && (
                        <p className="zx-profile-hint">{t('account.wallet.none')}</p>
                    )}

                    {!isLoadingWallets && wallets?.length > 0 && (
                        <ul className="zx-wallet-list">
                            {wallets.map((wallet: any) => (
                                <li key={wallet.id} className="zx-wallet">
                                    <div className="zx-wallet-head">
                                        <span className="zx-wallet-address">{wallet.address}</span>
                                        <button
                                            type="button"
                                            className="zx-profile-remove"
                                            onClick={() => openDeleteWalletModal(wallet)}
                                        >
                                            {t('account.wallet.remove')}
                                        </button>
                                    </div>

                                    <span className="zx-label">{t('account.wallet.names_label')}</span>
                                    {nameGroup(wallet, 'dcl')}
                                    {nameGroup(wallet, 'base')}
                                </li>
                            ))}
                        </ul>
                    )}

                    {selectedWallet && selectedName && (
                        <div className="zx-wallet-identity">
                            <img
                                src={getNameAvatarImage({ name: selectedName, address: selectedWallet })}
                                alt=""
                                width={72}
                                height={72}
                            />
                            <div>
                                <span className="zx-label">{t('account.wallet.identity_title')}</span>
                                <strong>{selectedName}</strong>
                            </div>
                        </div>
                    )}

                    {/* Removing a wallet can be undone by linking it again, so it
                        asks once and does not make anybody type a word. */}
                    {walletToDelete && (
                        <ConfirmActionModal
                            show={showDeleteWalletModal}
                            onClose={closeDeleteWalletModal}
                            onConfirm={() => handleDeleteWallet(walletToDelete.address)}
                            title={t('account.wallet.delete_title')}
                            message={t('account.wallet.delete_message')}
                            confirmButtonText={t('account.wallet.remove')}
                            cancelButtonText={t('project.delete_cancel')}
                        />
                    )}
                </OnchainKitProvider>
            )}
        </section>
    );
};

export default BindWallet;

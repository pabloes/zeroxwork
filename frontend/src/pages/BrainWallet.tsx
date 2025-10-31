import React, { useState } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256 } from 'viem/utils'; // Using keccak256 hash
import { toHex } from 'viem/utils';
import '../styles/BrainWallet.scss'; // Import the new SCSS styles for mobile
import { Link } from 'react-router-dom';
import { payments } from 'bitcoinjs-lib'; // Correct named imports
import * as ecc from 'tiny-secp256k1';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import { QRCodeSVG } from 'qrcode.react'; // Correct import for QR Code
import UIkit from 'uikit';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';

const bip32 = BIP32Factory(ecc);

// Define the QrCodeIcon component as per your request
const QrCodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path d="M4 11h2v2H4v-2zm0 4h2v2H4v-2zm0 4h2v2H4v-2zm0-16h2v2H4V3zm4 4h2v2H8V7zm0-4h2v2H8V3zm-4 8h2v2H4v-2zm4 4h2v2H8v-2zm4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm0-4h2v2h-2v-2zm0-4h2v2h-2v-2zm0-4h2v2h-2V7zm0-4h2v2h-2V3zm4 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0-16h2v2h-2V3zm4 0h2v2h-2V3z" />
    </svg>
);

const BrainWallet: React.FC = () => {
    const [phrase, setPhrase] = useState<string>('');
    const [mnemonic, setMnemonic] = useState<string | null>(null); // Store the 24-word mnemonic
    const [showMnemonic, setShowMnemonic] = useState<boolean>(false); // Toggle mnemonic and private key visibility
    const [wallets, setWallets] = useState<any[]>([]); // List of Ethereum, Bitcoin and Solana wallets
    const [showPhrase, setShowPhrase] = useState<boolean>(false); // Toggle phrase visibility (password input behavior)
    const [qrCodeData, setQrCodeData] = useState<string | null>(null); // For storing the public key for QR code

    // Blockchain filters
    const [showEth, setShowEth] = useState<boolean>(true);
    const [showBtc, setShowBtc] = useState<boolean>(true);
    const [showSol, setShowSol] = useState<boolean>(true);

    // Next wallet index to add (display value, starts at 1)
    const [nextWalletIndex, setNextWalletIndex] = useState<number>(3);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            UIkit.notification({
                message: 'Copied to clipboard',
                status: "success",
                pos: 'top-right',
                timeout: 2000
            });
        }, () => {
            UIkit.notification({
                message: 'Failed to copy to clipboard',
                status: "danger",
                pos: 'top-right',
                timeout: 2000
            });
        });
    };

    const showQRCodeModal = (publicKey: string) => {
        setQrCodeData(publicKey);
        UIkit.modal('#qr-modal').show();
    };

    async function generateWallets(phrase: string) {
        try {
            if (phrase.length) {
                const completePhrase = `ZeroxWork.com::${phrase}`;
                const hash = keccak256(toHex(new TextEncoder().encode(completePhrase)));

                // Generate a mnemonic from the passphrase
                const mnemonic = bip39.entropyToMnemonic(hash.substring(2, 66));
                setMnemonic(mnemonic);

                // Generate seed from the mnemonic
                const seed = await bip39.mnemonicToSeed(mnemonic);

                // Initialize wallets with the first two derivations (index 0 and 1)
                setWallets([deriveWallet(seed, 0), deriveWallet(seed, 1)]);
            } else {
                setMnemonic(null);
                setWallets([]);
            }
        } catch (error) {
            console.error('Error generating wallets:', error);
        }
    }

    function deriveWallet(seed: Buffer, index: number) {
        // Derive Ethereum keys from the seed
        const rootEth = bip32.fromSeed(seed);
        const ethChild = rootEth.derivePath(`m/44'/60'/0'/0/${index}`);
        const ethPrivateKey = (ethChild.privateKey as Buffer).toString("hex");
        const ethAccount = privateKeyToAccount(`0x${ethPrivateKey}`);

        // Derive Bitcoin legacy P2PKH (m/44'/0'/0'/0/index) address
        const rootBtcLegacy = bip32.fromSeed(seed);
        const btcChildLegacy = rootBtcLegacy.derivePath(`m/44'/0'/0'/0/${index}`);
        const btcAddressLegacy = payments.p2pkh({ pubkey: btcChildLegacy.publicKey }).address;

        // Derive Bitcoin Bech32 (SegWit, m/84'/0'/0'/0/index) address
        const rootBtcBech32 = bip32.fromSeed(seed);
        const btcChildBech32 = rootBtcBech32.derivePath(`m/84'/0'/0'/0/${index}`);
        const btcAddressBech32 = payments.p2wpkh({ pubkey: btcChildBech32.publicKey }).address;

        // Derive Solana keys from the seed (m/44'/501'/0'/0')
        const solanaPath = `m/44'/501'/${index}'/0'`;
        const solanaDerivation = derivePath(solanaPath, seed.toString('hex'));
        const solanaKeypair = Keypair.fromSeed(solanaDerivation.key);
        const solanaPublicKey = solanaKeypair.publicKey.toBase58();
        const solanaPrivateKey = Buffer.from(solanaKeypair.secretKey).toString('hex');

        return {
            derivationIndex: index + 1, // Store display index (1-based)
            eth: { privateKey: ethPrivateKey, publicKey: ethAccount.address },
            btcLegacy: { privateKey: btcChildLegacy.toWIF(), publicKey: btcAddressLegacy },
            btcBech32: { privateKey: btcChildBech32.toWIF(), publicKey: btcAddressBech32 },
            sol: { privateKey: solanaPrivateKey, publicKey: solanaPublicKey }
        };
    }

    const addWallet = () => {
        if (mnemonic && nextWalletIndex > 0) {
            bip39.mnemonicToSeed(mnemonic).then((seed) => {
                const derivationIndex = nextWalletIndex - 1; // Convert display index to internal index (0-based)
                const newWallet = deriveWallet(seed, derivationIndex);
                setWallets([...wallets, newWallet]);
                setNextWalletIndex(nextWalletIndex + 1); // Increment for next suggestion
            });
        }
    };

    const removeLastWallet = () => {
        if (wallets.length > 0) {
            const removedWallet = wallets[wallets.length - 1];
            const updatedWallets = wallets.slice(0, wallets.length - 1); // Remove last wallet
            setWallets(updatedWallets);
            // Set next index to the removed wallet's index
            setNextWalletIndex(removedWallet.derivationIndex);
        }
    };

    return (
        <div className="uk-container uk-padding-small">
            <h3 className="uk-text-muted">Inherit Eth, BTC & SOL Wallets from a memorable phrase</h3>

            <article className="uk-article uk-text-small">
                A brain wallet lets you create a secret digital key for your cryptocurrency using a memorable phrase, making it easier to remember but riskier if the phrase is too simple or guessable, although still practical.
                <br /><br />The private key is generated locally, not sent to any server.
            </article>

            <div className="uk-margin uk-flex uk-flex-middle">
                <button className="uk-icon-button uk-border-circle" uk-icon={showPhrase ? 'eye' : 'eye-slash'} onClick={() => setShowPhrase(!showPhrase)}></button>
                <input
                    autoFocus={true}
                    className="uk-input uk-width-expand"
                    type={showPhrase ? "text" : "password"} // Toggle between text and password input types
                    value={phrase}
                    onChange={(e) => {
                        setPhrase(e.target.value);
                        generateWallets(e.target.value);
                    }}
                    placeholder="Enter your passphrase"
                />
            </div>

            {phrase && (
                <>
                    <>
                        We add <b>prefix ZeroxWork.com::</b> to avoid generic brute force attempts, <b>the resulting phrase you need to note</b> is:
                        <pre className="uk-background-secondary uk-light uk-padding-small uk-panel" style={{ color: "white" }}>
                            {showPhrase ? `ZeroxWork.com::${phrase}` : "*****************"}
                        </pre>
                    </>
                </>
            )}

            {mnemonic && (
                <>
                    <div className="uk-margin">
                        <strong>24-Word Seed:</strong>
                        <div>
                            <button className="uk-icon-button uk-margin-left uk-icon" uk-icon="icon: eye" onClick={() => setShowMnemonic(!showMnemonic)}></button>
                            <button className="uk-icon-button uk-margin-left uk-icon" uk-icon="icon: copy" onClick={() => mnemonic && copyToClipboard(mnemonic)}></button>
                            <pre className="uk-background-secondary uk-light uk-padding-small uk-panel" style={{ color: "white" }}>{showMnemonic ? mnemonic : "••••••••••••••••••••••••••••••••••"}</pre>
                        </div>
                    </div>

                    {/* Blockchain Filters */}
                    <div className="uk-margin uk-card uk-card-default uk-card-body uk-padding-small">
                        <strong className="uk-margin-small-right">Filter Blockchains:</strong>
                        <label className="uk-margin-small-right">
                            <input
                                className="uk-checkbox uk-margin-small-right"
                                type="checkbox"
                                checked={showEth}
                                onChange={(e) => setShowEth(e.target.checked)}
                            />
                            Ethereum
                        </label>
                        <label className="uk-margin-small-right">
                            <input
                                className="uk-checkbox uk-margin-small-right"
                                type="checkbox"
                                checked={showBtc}
                                onChange={(e) => setShowBtc(e.target.checked)}
                            />
                            Bitcoin
                        </label>
                        <label>
                            <input
                                className="uk-checkbox uk-margin-small-right"
                                type="checkbox"
                                checked={showSol}
                                onChange={(e) => setShowSol(e.target.checked)}
                            />
                            Solana
                        </label>
                    </div>

                    <div className="wallet-grid uk-grid uk-grid-match uk-child-width-1-2@s uk-child-width-1-1" uk-grid="true">
                        {wallets.map((wallet, index) => (
                            <div key={index}>
                                <div className="uk-card uk-card-default uk-card-body">
                                    {showEth && (
                                        <>
                                            <h4>Ethereum Wallet #{wallet.derivationIndex}</h4>
                                            <p>
                                                <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => wallet.eth.publicKey && copyToClipboard(wallet.eth.publicKey)}></button>
                                                Public Key: {wallet.eth.publicKey}
                                                <button className="uk-icon-button uk-margin-left uk-icon" onClick={() => showQRCodeModal(wallet.eth.publicKey)}>
                                                    <QrCodeIcon />
                                                </button>
                                            </p>
                                            <p>
                                                <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => wallet.eth.privateKey && copyToClipboard(wallet.eth.privateKey)}></button>
                                                Private Key: {showMnemonic ? wallet.eth.privateKey : '••••••••••••••••••••••••••••••••••'}
                                            </p>
                                        </>
                                    )}

                                    {showBtc && (
                                        <>
                                            <h4>Bitcoin SegWit Wallet #{wallet.derivationIndex} (Bech32)</h4>
                                            <p>
                                                <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => wallet.btcBech32.publicKey && copyToClipboard(wallet.btcBech32.publicKey)}></button>
                                                Public Key: {wallet.btcBech32.publicKey}
                                                <button className="uk-icon-button uk-margin-left uk-icon" onClick={() => showQRCodeModal(wallet.btcBech32.publicKey)}>
                                                    <QrCodeIcon />
                                                </button>
                                            </p>
                                            <p>
                                                <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => wallet.btcBech32.privateKey && copyToClipboard(wallet.btcBech32.privateKey)}></button>
                                                Private Key: {showMnemonic ? wallet.btcBech32.privateKey : '••••••••••••••••••••••••••••••••••'}
                                            </p>
                                        </>
                                    )}

                                    {showSol && (
                                        <>
                                            <h4>Solana Wallet #{wallet.derivationIndex}</h4>
                                            <p>
                                                <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => wallet.sol.publicKey && copyToClipboard(wallet.sol.publicKey)}></button>
                                                Public Key: {wallet.sol.publicKey}
                                                <button className="uk-icon-button uk-margin-left uk-icon" onClick={() => showQRCodeModal(wallet.sol.publicKey)}>
                                                    <QrCodeIcon />
                                                </button>
                                            </p>
                                            <p>
                                                <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => wallet.sol.privateKey && copyToClipboard(wallet.sol.privateKey)}></button>
                                                Private Key: {showMnemonic ? wallet.sol.privateKey : '••••••••••••••••••••••••••••••••••'}
                                            </p>
                                        </>
                                    )}

                                  {/*    <h4>Bitcoin Legacy Wallet #{index + 1} (P2PKH)</h4>
                                    <p>
                                        <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => wallet.btcLegacy.publicKey && copyToClipboard(wallet.btcLegacy.publicKey)}></button>
                                        Public Key: {wallet.btcLegacy.publicKey}
                                        <button className="uk-icon-button uk-margin-left uk-icon" onClick={() => showQRCodeModal(wallet.btcLegacy.publicKey)}>
                                            <QrCodeIcon />
                                        </button>
                                    </p>
                                    <p>
                                        <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => wallet.btcLegacy.privateKey && copyToClipboard(wallet.btcLegacy.privateKey)}></button>
                                        Private Key: {showMnemonic ? wallet.btcLegacy.privateKey : '••••••••••••••••••••••••••••••••••'}
                                    </p>*/}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="uk-margin-top uk-flex uk-flex-center uk-flex-middle">
                        <label className="uk-margin-right uk-flex uk-flex-middle">
                            <span className="uk-margin-small-right">Wallet Index:</span>
                            <input
                                className="uk-input uk-form-width-small"
                                type="number"
                                min="1"
                                value={nextWalletIndex}
                                onChange={(e) => setNextWalletIndex(parseInt(e.target.value) || 1)}
                                style={{ width: '80px', textAlign: 'center' }}
                            />
                        </label>
                        <button className="uk-button uk-button-primary uk-margin-right" onClick={addWallet}>Add Wallet</button>
                        <button className="uk-button uk-button-danger" onClick={removeLastWallet} disabled={wallets.length === 0}>Remove Wallet</button>
                    </div>
                </>
            )}

            <hr className="uk-divider-icon" />

            <div className="uk-text-center uk-margin-top">
                <Link to="/old-brain-wallet" className="uk-link">
                    Old Brain Wallet
                </Link>
            </div>

            {/* QR Code Modal */}
            <div id="qr-modal" className="uk-modal-full" data-uk-modal>
                <div className="uk-modal-dialog uk-modal-body uk-flex uk-flex-center uk-flex-middle" data-uk-height-viewport>
                    <button className="uk-modal-close-full uk-close-large" type="button" data-uk-close></button>
                    {qrCodeData && <QRCodeSVG value={qrCodeData} size={256} />}
                </div>
            </div>
        </div>
    );
};

export default BrainWallet;

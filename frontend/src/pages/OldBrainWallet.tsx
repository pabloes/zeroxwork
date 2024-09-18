import React, { useState } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256 } from 'viem/utils'; // Using keccak256 hash
import { toHex } from 'viem/utils';
import '../styles/BrainWallet.scss';
import logo from "../../public/zerox-logo.png";
import img1 from "../../public/img1.png";
import img2 from "../../public/img2.png";
import img3 from "../../public/img3.png";
import { Link } from 'react-router-dom';
import { payments } from 'bitcoinjs-lib'; // Correct named imports

import * as ecc from 'tiny-secp256k1';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import UIkit from 'uikit'

const bip32 = BIP32Factory(ecc);

const OldBrainWallet: React.FC = () => {
    const [phrase, setPhrase] = useState<string>('');
    const [privateKey, setPrivateKey] = useState<string | null>(null);
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [bitcoinPrivateKey, setBitcoinPrivateKey] = useState<string | null>(null);
    const [bitcoinPublicKey, setBitcoinPublicKey] = useState<string | null>(null);
    const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false); // New state for ETH private key visibility
    const [showBitcoinPrivateKey, setShowBitcoinPrivateKey] = useState<boolean>(false); // New state for BTC private key visibility
    const [showPhrase, setShowPhrase] = useState<boolean>(true);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            UIkit.notification({
                message:'Copied to clipboard',
                status:"success",
                pos: 'top-right',
                timeout: 50000
            });
        }, () => {
            UIkit.notification({
                message:'Failed to copy to clipboard',
                status:"danger",
                pos: 'top-right',
                timeout: 50000
            });
        });
    };
    async function generateWallet  (phrase:string) {

        try {
            if(phrase?.length){

                // Hash the passphrase using keccak256 to generate a private key
                const completePhrase = `ZeroxWork.com::${phrase}`
                const hash = keccak256(toHex(new TextEncoder().encode(completePhrase)));
                const privateKey:`0x${string}` = `0x${hash.substring(2, 66)}`; // Ensure it's 32 bytes long
                // Derive the account from the private key
                const account = privateKeyToAccount(privateKey);

                setPrivateKey(privateKey);
                setPublicKey(account.address);

                const seed = await bip39.mnemonicToSeed(completePhrase);
                const root = bip32.fromSeed(seed);
                const child = root.derivePath("m/44'/0'/0'/0/0");
                const privateKeyWIF = child.toWIF();
                const { address } = payments.p2pkh({ pubkey: child.publicKey });

                setBitcoinPublicKey(address as string);
                setBitcoinPrivateKey( privateKeyWIF )
            }else{
                setPrivateKey(null);
                setPublicKey(null);
            }

        } catch (error) {
            console.error('Error generating the wallet:', error);
            setPrivateKey(null);
            setPublicKey(null);
        }
    };

    return (
        <div className="uk-container">
            <div className="uk-flex">
                <Link to={"/"}  className="uk-align-left">
                    <img style={{width:"128px"}} src={logo} alt="ZeroxWork Logo" />
                </Link>
                <div className="left">
                    <h1 className="uk-heading-medium">Brain Wallet Generator</h1>
                    <div style={{fontSize:"1.5rem"}}>Inherit Eth & BTC Wallet from a phrase</div>
                </div>

            </div>
            <article className="uk-article">
                A brain wallet lets you create a secret digital key for your cryptocurrency using a memorable phrase, making it easier to remember but riskier if the phrase is too simple or guessable although still practical.
                <br/><br/>The private key is generated in the user computer, not sent to any server.
                <br/>
            </article>

            <div className="uk-margin">
                <button disabled={!phrase} className="uk-icon-button uk-border-circle" uk-icon="icon: eye" onClick={() => setShowPhrase(!showPhrase)}></button>
                <input
                    autoFocus={true}
                    disabled={!showPhrase}
                    className="uk-input"
                    type="text"
                    value={showPhrase?phrase:"*****************"}
                    onChange={(e) => {
                        setPhrase(e.target.value);
                        generateWallet(e.target.value);
                    }}
                    placeholder="Enter your passphrase"
                />
                <br/>


            </div>
            {phrase && (
                <>
                    <>
                        We add <b>prefix ZeroxWork.com::</b> to avoid generic brute force attempts, <b>the resulting phrase you need to note</b> is:
                        <pre  className="uk-background-secondary uk-light uk-padding-small uk-panel" style={{color:"white"}}>{showPhrase?`ZeroxWork.com::${phrase}`:"*****************"}</pre>
                    </>
                    <dl className="uk-description-list ">
                        <dt>Ethereum & EVM Compatible: 0xPolygon, Arbitrum, Optimism, etc.</dt>

                        <dd className="uk-margin-left uk-padding-left" style={{left:"-36px", position:"relative"}}>
                            <button  className="uk-icon-button uk-border-circle" uk-icon="icon: eye" onClick={() => setShowPrivateKey(!showPrivateKey)}></button>
                            <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => privateKey && copyToClipboard(privateKey)}></button>
                            <strong>Private Key:</strong> {showPrivateKey ? privateKey : '••••••••••••••••••••••••••••••••••'}
                        </dd>
                        <dd className="uk-margin-left">
                            <button style={{left:"-0px", position:"relative"}}
                                    className="uk-icon-button uk-border-circle"
                                    uk-icon="icon: copy" onClick={() => publicKey && copyToClipboard(publicKey)}></button>
                            <strong>Public Key:</strong> {publicKey}</dd>
                        <dd className="uk-margin-left" > <span data-uk-toggle="target: #metamask" className=" uk-link">How to import ETH private key into Metamask</span></dd>
                        <div id="metamask" data-uk-modal>
                            <div className="uk-modal-dialog uk-modal-body" style={{width:"90%"}}>
                                <div className="uk-panel">
                                    <div aria-label="Close" className="uk-modal-close uk-align-left " data-uk-close={true}></div>
                                    <h2 className="uk-modal-title uk-align-left">How to import ETH private key into Metamask</h2>
                                </div>
                                <div className="uk-panel uk-flex uk-flex-center">
                                    <div className="uk-card uk-card-default uk-card-body"><img className="center" style={{width:"240px", margin:"10px"}} src={img1} /></div>
                                    <div className="uk-card uk-card-default uk-card-body uk-margin-left"><img className="center" style={{width:"240px", margin:"10px"}} src={img2} /></div>
                                    <div className="uk-card uk-card-default uk-card-body uk-margin-left"><img className="center" style={{width:"240px", margin:"10px"}} src={img3} /></div>
                                </div>

                            </div>
                        </div>
                    </dl>
                    <dl className="uk-description-list">
                        <dt>Bitcoin wallet</dt>
                        <dd  className="uk-margin-left" style={{left:"-36px", position:"relative"}}>
                            <button  className="uk-icon-button uk-border-circle" uk-icon="icon: eye" onClick={() => setShowBitcoinPrivateKey(!showBitcoinPrivateKey)}></button>
                            <button className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => privateKey && copyToClipboard(bitcoinPrivateKey as string)}></button>
                            <strong>Private Key:</strong> {showBitcoinPrivateKey ? bitcoinPrivateKey : '••••••••••••••••••••••••••••••••••'}
                        </dd>
                        <dd  className="uk-margin-left">
                            <button  style={{left:"-0px", position:"relative"}} className="uk-icon-button uk-border-circle" uk-icon="icon: copy" onClick={() => bitcoinPublicKey && copyToClipboard(bitcoinPublicKey)}></button>
                            <strong>Public Key:</strong> {bitcoinPublicKey}
                        </dd>
                    </dl>
                </>

            )}

            <hr className="uk-divider-icon" />
            <div className="uk-container">
                This is the snippet to generate the key
                <br/>
                <code className="javascript">
                    const completePhrase = `ZeroxWork.com::$&#123;phrase&#125;`
                    <br/><br/>
                    //ETHEREUM WALLET GENERATION<br/>
                    <span>const hash = keccak256(toHex(new TextEncoder().encode(`ZeroxWork.com::$&#123;completePhrase&#125;`)));</span>
                    <br/>
                    <span>const privateKey:`0x$&#123;string&#125;` = `0x$&#123;completePhrase.substring(2, 66)&#125;`;</span>
                    <br/>  <br/>
                    //BITCOIN WALLET GENERATION
                    <br/>
                    const seed = await bip39.mnemonicToSeed(completePhrase);    <br/>
                    const root = bip32.fromSeed(seed);    <br/>
                    const child = root.derivePath("m/44'/0'/0'/0/0");    <br/>
                    const privateKeyWIF = child.toWIF();    <br/>
                    const &#123; address &#125; = payments.p2pkh(0x$&#123; pubkey: child.publicKey &#125;);    <br/>
                </code>
            </div>
        </div>
    );
};

export default OldBrainWallet;
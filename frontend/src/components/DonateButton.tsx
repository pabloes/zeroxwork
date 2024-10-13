import React, { useState } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import {parseEther} from 'viem';
import { ConnectKitButton } from 'connectkit';

interface DonateButtonProps {
    donationAddress: string;
}

const DonateButton: React.FC<DonateButtonProps> = ({ donationAddress }) => {
    // Estado para el monto de la donación
    const [donationAmount, setDonationAmount] = useState('0.01'); // Donación por defecto a 0.01 ETH

    // Obtener la cuenta conectada
    const { address, isConnected } = useAccount();

    // Enviar la transacción de donación
    const { sendTransaction } = useSendTransaction();

    return (
        <div>
            {!isConnected ? (
                <ConnectKitButton  /> // Botón de conexión de ConnectKit
            ) : (
                <div>
                    <div>Conectado como: {address}</div>
                    <label>
                        ETH Amount:&nbsp;
                        <input
                            type="number"
                            value={donationAmount}
                            onChange={(e) => setDonationAmount(e.target.value)}
                            min="0.001"
                            step="0.001"
                        />&nbsp;
                    </label>
                    <button onClick={()=> sendTransaction({
                        to: donationAddress  as `0x${string}`,
                        value: parseEther(donationAmount),
                    })}>
                        Donar {donationAmount} ETH
                    </button>
                </div>
            )}
        </div>
    );
};

export default DonateButton;

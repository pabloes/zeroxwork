import React, { useState } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import {parseEther, parseUnits} from 'viem';
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
    const { sendTransaction } = useSendTransaction({
        to: donationAddress,
        value: parseEther(donationAmount), // Convierte el monto a wei
    });

    // Manejador de envío de donación
    const handleDonate = async () => {
        console.log("handleDonate", {
            to: donationAddress,
            value: Number(parseEther(donationAmount)),
        })
        try {
            debugger;
            sendTransaction();
        } catch (error) {
            console.error('Error al enviar la donación:', error);
        }
    };

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
                        to: donationAddress,
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

// backend/src/services/decentralandService.ts

import axios from 'axios';
import {prisma} from "../db";

export async function updateWalletNames(walletAddress: string) {
    try {
        const response = await axios.get(
            `https://nft-api.decentraland.org/v1/nfts?first=24&skip=0&sortBy=newest&category=ens&owner=${walletAddress}`
        );

        const nameNFTs = response.data.data;

        // Busca la wallet en la base de datosacti
        const wallet = await prisma.wallet.findUnique({
            where: { address: walletAddress.toLowerCase() },
        });

        if (!wallet) {
            console.error('Wallet not found in database:', walletAddress);
            return;
        }

        // Borra los nombres antiguos vinculados a la wallet
        await prisma.walletDecentralandNames.deleteMany({
            where: { walletId: wallet.id },
        });

        // Inserta los nuevos nombres en la base de datos
        const walletNames = nameNFTs.map((nameNFT: any) => ({
            walletId: wallet.id,
            name: nameNFT.nft.name, // Ajusta según la estructura de los datos recibidos
        }));

        await prisma.walletDecentralandNames.createMany({
            data: walletNames,
        });

        // Actualiza la cuota del usuario (5 MB por cada nombre Decentraland)
        const extraQuota = nameNFTs.length * 5 * 1024 * 1024; // 5 MB por nombre
        await prisma.user.update({
            where: { id: wallet.userId },
            data: { extraQuota },
        });

        return walletNames;
    } catch (error) {
        console.error('Error fetching Decentraland names:', error);
    }
}

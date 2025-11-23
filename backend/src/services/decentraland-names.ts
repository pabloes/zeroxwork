// backend/src/services/decentralandService.ts

import axios from 'axios';
import {prisma} from "../db";
export async function updateUserExtraSpace(user:{wallets:{walletNames:[]}[]}){
    let pointsPerNames = 0;
    user.wallets.forEach(wallet => wallet.walletNames.forEach(nameNFT => {
        pointsPerNames++;
    }));
    console.log("pointsPerNames",pointsPerNames)
    const updateResult = await prisma.user.update({
        where: { id: user.id },
        data: { extraQuota:pointsPerNames*1024*1024*5 },
    })
    return updateResult;
}
export async function updateWalletNames(walletAddress: string) {
    try {
        return [
            ...await fetchAndCreateDecentralandNames(),
            ...await fetchAndCreateBaseNames()
        ];
    } catch (error) {
        console.error('Error fetching Decentraland names:', error);
    }

    async function fetchAndCreateBaseNames(){
        const response = await axios.get(`https://api.wallet.coinbase.com/rpc/v2/collectibles/getWalletCollectionTokens`, {
            params:{
                page:"",
                contractAddress: '0x03c4738ee98ae44591e1a4a4f3cab6641d95dd9a',
                walletAddress: walletAddress,
                limit: 20,
                chainId: 8453
            }
        });

        const nameNFTs = response.data.result.tokenList;
        const wallet = await prisma.wallet.findUnique({
            where: { address: walletAddress.toLowerCase() },
        });
        if (!wallet) {
            console.error('Wallet not found in database:', walletAddress);
            return;
        }
        // Borra los nombres antiguos vinculados a la wallet
        await prisma.walletNames.deleteMany({
            where: { walletId: wallet.id, subdomain:"base" },
        });

        // Inserta los nuevos nombres en la base de datos
        const walletNames = nameNFTs.map((nameNFT: any) => ({
            walletId: wallet.id,
            name: nameNFT.name, // Ajusta según la estructura de los datos recibidos
            subdomain:"base"
        }));
        await prisma.walletNames.createMany({
            data: walletNames,
        });
        return walletNames;
    }

    async function fetchAndCreateDecentralandNames(){
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
        await prisma.walletNames.deleteMany({
            where: { walletId: wallet.id, subdomain:"dcl" },
        });

        // Inserta los nuevos nombres en la base de datos
        const walletNames = nameNFTs.map((nameNFT: any) => ({
            walletId: wallet.id,
            name: `${nameNFT.nft.name}.dcl.eth`, // Ajusta según la estructura de los datos recibidos
            subdomain:"dcl"
        }));

        await prisma.walletNames.createMany({
            data: walletNames,
        });

        return walletNames;
    }
}

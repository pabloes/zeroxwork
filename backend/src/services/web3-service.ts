import {hashMessage, recoverAddress, Signature} from 'viem';
import {prisma} from "../db";
import {updateWalletNames} from "./decentraland-names";

export async function verifySignature(address: string, signature: Signature, message: string) {
    // Crear el hash del mensaje
    const messageHash = hashMessage(message);

    // Recuperar la dirección de la firma
    const recoveredAddress = await recoverAddress({ hash: messageHash, signature:signature  });

    // Verificar si la dirección coincide con la proporcionada
    return recoveredAddress.toLowerCase() === address.toLowerCase();
}

export async function addWalletToUser(userId: number, address: string) {
    const result =  await prisma.wallet.findFirst({where:{userId}}) || await prisma.wallet.create({
        data: {
            address,
            userId,
        },
    });
    await updateWalletNames(address.toLowerCase());
    return result;
}

import { http, createConfig } from 'wagmi'
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains'
import {base} from "viem/chains";
export const wagmiConfig = createConfig({
    chains: [base, mainnet, polygon],
    transports: {
        [mainnet.id]: http(),
        [base.id]: http(),
        [polygon.id]: http(),
        [optimism.id]: http(),
        [arbitrum.id]: http()
    },
})
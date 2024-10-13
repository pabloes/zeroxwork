import { http, createConfig } from 'wagmi'
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains'
import {base} from "viem/chains";
export const wagmiConfig = createConfig({
    chains: [base],
    transports: {

        [base.id]: http(),

    },
})
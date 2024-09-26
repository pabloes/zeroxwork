import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, polygon, optimism, arbitrum } from 'wagmi/chains'
export const wagmiConfig = createConfig({
    chains: [mainnet, sepolia],
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
        [polygon.id]: http(),
        [optimism.id]: http(),
        [arbitrum.id]: http()
    },
})
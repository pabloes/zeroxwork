import { http, createConfig } from 'wagmi'
import {base} from "viem/chains";
export const wagmiConfig = createConfig({
    chains: [base],
    transports: {

        [base.id]: http(),

    },
})
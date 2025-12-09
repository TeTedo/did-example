import { http, createConfig } from "wagmi";
import { sepolia, mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { type Chain } from "viem";

// Custom localhost chain matching Anvil's default chain ID
export const localChain = {
  id: 31337,
  name: "Localhost",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
} as const satisfies Chain;

export const defaultChain = localChain;

export const config = createConfig({
  chains: [localChain, sepolia, mainnet],
  connectors: [
    injected(), // MetaMask and other injected wallets
  ],
  transports: {
    [localChain.id]: http(),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
});

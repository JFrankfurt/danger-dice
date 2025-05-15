import farcasterFrame from "@farcaster/frame-wagmi-connector";
import { cookieStorage, createConfig, createStorage, webSocket } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

const BASE_ALCHEMY_WS_URL =
  "wss://base-mainnet.g.alchemy.com/v2/4hCSzpE_3nI46hgVbaqxhCbE7ARHSPMX";
const BASE_SEPOLIA_ALCHEMY_WS_URL =
  "wss://eth-sepolia.g.alchemy.com/v2/4hCSzpE_3nI46hgVbaqxhCbE7ARHSPMX";
export function getConfig() {
  return createConfig({
    chains: [base, baseSepolia],
    connectors: [farcasterFrame()],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [base.id]: webSocket(BASE_ALCHEMY_WS_URL),
      [baseSepolia.id]: webSocket(BASE_SEPOLIA_ALCHEMY_WS_URL),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}

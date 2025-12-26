import { createConfig, createStorage, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sepolia } from 'wagmi/chains';

const memoryStore = new Map<string, string>();

const memoryStorage = {
  getItem(key: string) {
    return memoryStore.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memoryStore.set(key, value);
  },
  removeItem(key: string) {
    memoryStore.delete(key);
  },
};

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
  },
  storage: createStorage({ storage: memoryStorage }),
  ssr: false,
});

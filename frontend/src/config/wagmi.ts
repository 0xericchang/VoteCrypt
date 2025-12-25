import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'VoteCrypt',
  projectId: 'b4c5a8a0a2bc4989a1b3e21f34e6c3dd',
  chains: [sepolia],
  ssr: false,
});

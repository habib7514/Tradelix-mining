
import './style.css';

import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { bsc } from '@reown/appkit/networks';

const projectId = 'be63be7be2e8c243abb3a982be799a67';

const networks = [bsc];

const metadata = {
  name: 'Tradelix Mining',
  description: 'Tradelix AI TLX Mining Platform',
  url: 'https://habib7514.github.io',
  icons: []
};

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks
});

const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: []
  }
});

const connectButton = document.getElementById('connectButton');
const walletElement = document.getElementById('wallet');
const statusElement = document.getElementById('status');

connectButton.addEventListener('click', () => {
  modal.open();
});

modal.subscribeAccount((account) => {
  if (account.isConnected && account.address) {
    walletElement.textContent =
      account.address.slice(0, 8) + '...' +
      account.address.slice(-6);

    statusElement.textContent =
      'Wallet connected successfully.';

    connectButton.textContent = 'WALLET CONNECTED';
  } else {
    walletElement.textContent = 'Not connected';
    statusElement.textContent = 'Please connect your wallet';
    connectButton.textContent = 'CONNECT WALLET';
  }
});

document.getElementById('buyButton').addEventListener('click', () => {
  alert('TLX sale contract is not active yet.');
});

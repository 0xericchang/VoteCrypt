import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="brand">
          <div className="brand-mark">VC</div>
          <div>
            <p className="brand-title">VoteCrypt</p>
            <p className="brand-subtitle">Encrypted voting on Sepolia</p>
          </div>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}

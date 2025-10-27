'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x005FEFD5247Cbfbe230e6B2d5a71290B1861241B';

const CONTRACT_ABI = [
  "function createBoost(string memory _castHash, uint256 _rewardPerRecast, uint256 _maxRecasts) external payable",
  "function recastAndEarn(uint256 _boostId) external",
  "function claimRewards() external",
  "function getActiveBoosts() external view returns (tuple(uint256 id, address creator, string castHash, uint256 rewardPool, uint256 rewardPerRecast, uint256 maxRecasts, uint256 currentRecasts, bool isActive, uint256 createdAt)[])",
  "function userEarnings(address) external view returns (uint256)",
  "function boostCounter() external view returns (uint256)",
  "function boosts(uint256) external view returns (uint256 id, address creator, string castHash, uint256 rewardPool, uint256 rewardPerRecast, uint256 maxRecasts, uint256 currentRecasts, bool isActive, uint256 createdAt)",
  "function hasUserRecasted(uint256 _boostId, address _user) external view returns (bool)"
];

export default function Home() {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [boosts, setBoosts] = useState([]);
  const [earnings, setEarnings] = useState('0');
  const [loading, setLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showRecastModal, setShowRecastModal] = useState(false);
  const [selectedBoostId, setSelectedBoostId] = useState(null);
  const [recastProof, setRecastProof] = useState('');
  
  const [castHash, setCastHash] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');
  const [maxRecasts, setMaxRecasts] = useState('');

  useEffect(() => {
    loadBoosts();
    const interval = setInterval(loadBoosts, 15000);
    return () => clearInterval(interval);
  }, [contract]);

  const connectWallet = async (walletType) => {
    try {
      let ethereum;
      
      if (walletType === 'metamask') {
        if (typeof window.ethereum !== 'undefined') {
          if (window.ethereum.providers) {
            ethereum = window.ethereum.providers.find(p => p.isMetaMask);
          } else if (window.ethereum.isMetaMask) {
            ethereum = window.ethereum;
          }
        }
        
        if (!ethereum) {
          alert('🦊 MetaMask not found! Installing...');
          window.open('https://metamask.io', '_blank');
          return;
        }
      } else if (walletType === 'base') {
        if (typeof window.ethereum !== 'undefined') {
          if (window.ethereum.providers) {
            ethereum = window.ethereum.providers.find(p => p.isCoinbaseWallet);
          } else if (window.ethereum.isCoinbaseWallet) {
            ethereum = window.ethereum;
          }
        }
        
        if (!ethereum) {
          alert('💙 Coinbase Wallet not found! Installing...');
          window.open('https://www.coinbase.com/wallet', '_blank');
          return;
        }
      }

      let accounts;
      try {
        accounts = await ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
      } catch (err) {
        if (err.code === 4001) {
          alert('❌ Connection rejected. Please approve in wallet.');
        }
        setShowWalletModal(false);
        return;
      }
      
      if (!accounts || accounts.length === 0) {
        alert('❌ No accounts found. Unlock your wallet.');
        setShowWalletModal(false);
        return;
      }

      const chainId = await ethereum.request({ method: 'eth_chainId' });
      
      if (chainId !== '0x2105') {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            try {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x2105',
                  chainName: 'Base Mainnet',
                  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org']
                }],
              });
            } catch (addError) {
              alert('⚠️ Add Base Mainnet manually');
              setShowWalletModal(false);
              return;
            }
          }
        }
      }
      
      const web3Provider = new ethers.BrowserProvider(ethereum);
      const signer = await web3Provider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      setAccount(accounts[0]);
      setContract(contractInstance);
      setProvider(web3Provider);
      
      try {
        const userEarnings = await contractInstance.userEarnings(accounts[0]);
        setEarnings(ethers.formatEther(userEarnings));
      } catch {
        setEarnings('0');
      }
      
      setShowWalletModal(false);
      alert('✅ Wallet Connected!');
    } catch (error) {
      console.error('Connection error:', error);
      alert('❌ Failed: ' + error.message);
      setShowWalletModal(false);
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setContract(null);
    setProvider(null);
    setEarnings('0');
    alert('👋 Disconnected!');
  };

  const loadBoosts = async () => {
    if (!contract) return;
    
    try {
      const activeBoosts = await contract.getActiveBoosts();
      setBoosts(activeBoosts);
    } catch (error) {
      console.error('Error loading boosts:', error);
    }
  };

  const createBoost = async () => {
    if (!contract || !castHash || !rewardAmount || !maxRecasts) {
      alert('⚠️ Fill all fields and connect wallet!');
      return;
    }

    try {
      setLoading(true);
      const rewardPerRecast = ethers.parseEther(rewardAmount);
      const totalDeposit = rewardPerRecast * BigInt(maxRecasts);
      
      const balance = await provider.getBalance(account);
      if (balance < totalDeposit) {
        alert('❌ Insufficient balance! Need ' + ethers.formatEther(totalDeposit) + ' ETH');
        setLoading(false);
        return;
      }
      
      const tx = await contract.createBoost(castHash, rewardPerRecast, maxRecasts, {
        value: totalDeposit
      });
      
      alert('⏳ Transaction submitted! Waiting for confirmation...');
      await tx.wait();
      alert('🚀 Boost Created!');
      
      setCastHash('');
      setRewardAmount('');
      setMaxRecasts('');
      await loadBoosts();
    } catch (error) {
      console.error('Create boost error:', error);
      if (error.message.includes('user rejected')) {
        alert('❌ Transaction cancelled');
      } else if (error.message.includes('insufficient funds')) {
        alert('❌ Insufficient funds for gas');
      } else {
        alert('❌ Failed: ' + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const openRecastModal = (boostId) => {
    setSelectedBoostId(boostId);
    setRecastProof('');
    setShowRecastModal(true);
  };

  const recastBoost = async () => {
    if (!contract || !selectedBoostId) return;

    if (!recastProof || recastProof.trim() === '') {
      alert('⚠️ Paste your recast URL/hash!');
      return;
    }

    try {
      setLoading(true);
      
      const boost = boosts.find(b => b.id.toString() === selectedBoostId.toString());
      
      if (!boost) {
        alert('❌ Boost not found');
        setLoading(false);
        return;
      }
      
      if (boost.creator.toLowerCase() === account.toLowerCase()) {
        alert('⚠️ Cannot recast your own boost!');
        setShowRecastModal(false);
        setLoading(false);
        return;
      }
      
      if (boost.currentRecasts >= boost.maxRecasts) {
        alert('⚠️ Max recasts reached!');
        setShowRecastModal(false);
        setLoading(false);
        return;
      }
      
      const tx = await contract.recastAndEarn(selectedBoostId);
      alert('⏳ Verifying recast...');
      await tx.wait();
      
      alert('💰 Earned ' + ethers.formatEther(boost.rewardPerRecast) + ' ETH!');
      setShowRecastModal(false);
      setRecastProof('');
      
      await loadBoosts();
      const userEarnings = await contract.userEarnings(account);
      setEarnings(ethers.formatEther(userEarnings));
    } catch (error) {
      console.error('Recast error:', error);
      if (error.message.includes('Already recasted') || error.message.includes('already recasted')) {
        alert('⚠️ You already recasted this!');
      } else if (error.message.includes('Max recasts')) {
        alert('⚠️ Max recasts reached!');
      } else if (error.message.includes('Creator cannot')) {
        alert('⚠️ Cannot recast own boost!');
      } else if (error.message.includes('user rejected')) {
        alert('❌ Transaction cancelled');
      } else {
        alert('❌ Failed: ' + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.claimRewards();
      alert('⏳ Claiming rewards...');
      await tx.wait();
      
      alert('🎉 Rewards Claimed!');
      setEarnings('0');
    } catch (error) {
      console.error('Claim error:', error);
      if (error.message.includes('No rewards')) {
        alert('⚠️ No rewards to claim!');
      } else {
        alert('❌ Failed: ' + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-purple-500 rounded-full opacity-20 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-40 right-20 w-40 h-40 bg-pink-500 rounded-full opacity-20 blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-60 h-60 bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Recast Modal */}
      {showRecastModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-8 max-w-lg w-full border-4 border-purple-500 shadow-2xl transform transition-all">
            <h3 className="text-3xl font-bold text-white mb-4 text-center">
              🔍 Verify Your Recast
            </h3>
            <p className="text-purple-200 mb-6 text-center">
              Paste your Farcaster recast URL or hash to verify!
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-purple-300 mb-2 font-bold">Recast Proof</label>
                <input
                  type="text"
                  value={recastProof}
                  onChange={(e) => setRecastProof(e.target.value)}
                  placeholder="https://warpcast.com/... or cast hash"
                  className="w-full bg-black bg-opacity-60 border-4 border-purple-500 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-400"
                />
              </div>

              <div className="bg-purple-800 bg-opacity-40 border-2 border-purple-600 rounded-lg p-4">
                <p className="text-sm text-purple-200">
                  <strong className="text-yellow-400">📋 How to verify:</strong><br/>
                  1. Recast the boost on Farcaster<br/>
                  2. Copy your recast URL<br/>
                  3. Paste here to earn!
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={recastBoost}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 shadow-lg border-2 border-green-400"
                >
                  {loading ? '⏳ Verifying...' : '✅ Verify & Earn'}
                </button>

                <button
                  onClick={() => setShowRecastModal(false)}
                  disabled={loading}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all border-2 border-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 max-w-md w-full border-4 border-purple-500 shadow-2xl">
            <h3 className="text-3xl font-bold text-white mb-6 text-center">
              🔗 Choose Wallet
            </h3>
            
            <div className="space-y-4">
              <button
                onClick={() => connectWallet('metamask')}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center justify-center space-x-3 border-2 border-yellow-400"
              >
                <span className="text-3xl">🦊</span>
                <span className="text-xl">MetaMask</span>
              </button>

              <button
                onClick={() => connectWallet('base')}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center justify-center space-x-3 border-2 border-cyan-400"
              >
                <span className="text-3xl">💙</span>
                <span className="text-xl">Coinbase Wallet</span>
              </button>

              <button
                onClick={() => setShowWalletModal(false)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl transition-all border-2 border-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-black bg-opacity-50 backdrop-blur-md border-b-4 border-purple-500 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 animate-pulse">
            💎 PaidCaster
          </h1>
          
          {!account ? (
            <button
              onClick={() => setShowWalletModal(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-110 shadow-lg border-2 border-purple-400"
            >
              🔗 Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="bg-black bg-opacity-60 px-5 py-3 rounded-full border-2 border-green-500 shadow-lg">
                <span className="text-green-400 font-mono text-sm font-bold">
                  ✅ {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </div>
              <button
                onClick={disconnectWallet}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-110 shadow-lg border-2 border-red-400"
              >
                🚪 Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            🚀 Boost Your Casts, Earn Rewards
          </h2>
          <p className="text-2xl text-purple-200">
            Pay to amplify Farcaster posts. Get rewarded for spreading the word.
          </p>
        </div>

        {/* Earnings */}
        {account && (
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-8 mb-8 shadow-2xl border-4 border-green-400">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <p className="text-white text-opacity-90 mb-2 text-lg">💰 Your Earnings</p>
                <h3 className="text-5xl font-bold text-white drop-shadow-lg">{earnings} ETH</h3>
              </div>
              <button
                onClick={claimRewards}
                disabled={loading || parseFloat(earnings) === 0}
                className="bg-white text-green-700 font-bold py-4 px-10 rounded-full hover:bg-opacity-90 transition-all transform hover:scale-110 disabled:opacity-50 shadow-lg border-4 border-white text-xl"
              >
                💎 Claim
              </button>
            </div>
          </div>
        )}

        {/* Create Boost */}
        <div className="bg-black bg-opacity-60 backdrop-blur-xl rounded-3xl p-8 mb-8 border-4 border-purple-500 shadow-2xl">
          <h3 className="text-4xl font-bold text-white mb-6">✨ Create Boost</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-purple-300 mb-3 font-bold text-lg">📝 Cast Hash/URL</label>
              <input
                type="text"
                value={castHash}
                onChange={(e) => setCastHash(e.target.value)}
                placeholder="Farcaster cast hash or URL"
                className="w-full bg-gray-800 border-4 border-purple-500 rounded-xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:border-pink-500 focus:bg-gray-700"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-purple-300 mb-3 font-bold text-lg">💵 Reward/Recast (ETH)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  placeholder="0.001"
                  className="w-full bg-gray-800 border-4 border-purple-500 rounded-xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:border-pink-500 focus:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-purple-300 mb-3 font-bold text-lg">🔢 Max Recasts</label>
                <input
                  type="number"
                  value={maxRecasts}
                  onChange={(e) => setMaxRecasts(e.target.value)}
                  placeholder="10"
                  className="w-full bg-gray-800 border-4 border-purple-500 rounded-xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:border-pink-500 focus:bg-gray-700"
                />
              </div>
            </div>

            <button
              onClick={createBoost}
              disabled={loading || !account}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-5 px-6 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 shadow-lg border-4 border-purple-400 text-2xl"
            >
              {loading ? '⏳ Processing...' : '🚀 Create Boost'}
            </button>
          </div>
        </div>

        {/* Active Boosts */}
        <div className="bg-black bg-opacity-60 backdrop-blur-xl rounded-3xl p-8 border-4 border-purple-500 shadow-2xl">
          <h3 className="text-4xl font-bold text-white mb-6">🔥 Active Boosts</h3>
          
          {boosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-purple-200 text-2xl">No active boosts. Create first! 🎉</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boosts.map((boost) => (
                <div
                  key={boost.id.toString()}
                  className="bg-gradient-to-br from-purple-700 to-blue-700 rounded-2xl p-6 shadow-xl border-4 border-purple-400 hover:scale-105 transition-all"
                >
                  <div className="mb-4">
                    <span className="bg-yellow-400 text-purple-900 text-sm font-bold px-4 py-2 rounded-full shadow-lg">
                      ⭐ #{boost.id.toString()}
                    </span>
                  </div>
                  
                  <p className="text-purple-200 text-sm mb-2">📌 Cast:</p>
                  <p className="text-white font-mono text-xs mb-4 break-all bg-black bg-opacity-40 p-2 rounded border-2 border-purple-400">{boost.castHash}</p>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between bg-black bg-opacity-40 p-3 rounded-lg border-2 border-purple-400">
                      <span className="text-purple-200">💵 Reward:</span>
                      <span className="text-yellow-400 font-bold">{ethers.formatEther(boost.rewardPerRecast)} ETH</span>
                    </div>
                    <div className="flex justify-between bg-black bg-opacity-40 p-3 rounded-lg border-2 border-purple-400">
                      <span className="text-purple-200">📊 Progress:</span>
                      <span className="text-green-400 font-bold">{boost.currentRecasts.toString()}/{boost.maxRecasts.toString()}</span>
                    </div>
                    <div className="flex justify-between bg-black bg-opacity-40 p-3 rounded-lg border-2 border-purple-400">
                      <span className="text-purple-200">💰 Pool:</span>
                      <span className="text-cyan-400 font-bold">{ethers.formatEther(boost.rewardPool)} ETH</span>
                    </div>
                  </div>

                  <button
                    onClick={() => openRecastModal(boost.id)}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 shadow-lg border-2 border-green-400 text-lg"
                  >
                    ♻️ Recast & Earn
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black bg-opacity-50 backdrop-blur-md border-t-4 border-purple-500 mt-12 py-6 relative z-10">
        <div className="container mx-auto px-4 text-center text-purple-200">
          <p className="text-lg">
            Built on <span className="text-blue-400 font-bold">Base 💙</span> | Contract: 
            <span className="text-yellow-400 font-mono ml-2">{CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { Contract, formatUnits, parseUnits } from 'ethers';

import { Header } from './Header';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { FUSDC_ADDRESS, FUSDC_ABI, FZAMA_ADDRESS, FZAMA_ABI, SWAP_ADDRESS, SWAP_ABI } from '../config/contracts';
import '../styles/SwapApp.css';

type Hex32 = `0x${string}`;

function isHex32(value: unknown): value is Hex32 {
  return typeof value === 'string' && value.startsWith('0x') && value.length === 66;
}

async function decryptHandles(params: {
  instance: any;
  signer: any;
  userAddress: Hex32;
  contractAddress: Hex32;
  handles: Hex32[];
}) {
  const { instance, signer, userAddress, contractAddress, handles } = params;

  const keypair = instance.generateKeypair();
  const handleContractPairs = handles.map((handle) => ({ handle, contractAddress }));
  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = '10';
  const contractAddresses = [contractAddress];

  const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );

  const result = await instance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace('0x', ''),
    contractAddresses,
    userAddress,
    startTimeStamp,
    durationDays,
  );

  return result as Record<string, bigint>;
}

export function SwapApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: isZamaLoading, error: zamaError } = useZamaInstance();

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: sepolia,
        transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
      }),
    [],
  );

  const [encryptedUsdcBalance, setEncryptedUsdcBalance] = useState<Hex32 | null>(null);
  const [encryptedZamaBalance, setEncryptedZamaBalance] = useState<Hex32 | null>(null);
  const [decryptedUsdcBalance, setDecryptedUsdcBalance] = useState<bigint | null>(null);
  const [decryptedZamaBalance, setDecryptedZamaBalance] = useState<bigint | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [status, setStatus] = useState<string>('');

  const [mintUsdc, setMintUsdc] = useState('100');
  const [mintZama, setMintZama] = useState('100');

  const [liqUsdc, setLiqUsdc] = useState('2');
  const [liqZama, setLiqZama] = useState('1');

  const [swapDirection, setSwapDirection] = useState<'USDC_TO_ZAMA' | 'ZAMA_TO_USDC'>('USDC_TO_ZAMA');
  const [swapAmount, setSwapAmount] = useState('1');

  const refreshBalances = useCallback(async () => {
    if (!isConnected || !address) return;
    setIsRefreshing(true);
    setStatus('');
    try {
      const [usdcBal, zamaBal] = await Promise.all([
        publicClient.readContract({
          address: FUSDC_ADDRESS,
          abi: FUSDC_ABI,
          functionName: 'confidentialBalanceOf',
          args: [address as Hex32],
        }),
        publicClient.readContract({
          address: FZAMA_ADDRESS,
          abi: FZAMA_ABI,
          functionName: 'confidentialBalanceOf',
          args: [address as Hex32],
        }),
      ]);

      setEncryptedUsdcBalance(isHex32(usdcBal) ? usdcBal : null);
      setEncryptedZamaBalance(isHex32(zamaBal) ? zamaBal : null);
      setDecryptedUsdcBalance(null);
      setDecryptedZamaBalance(null);
    } catch (e) {
      console.error(e);
      setStatus('Failed to refresh balances');
    } finally {
      setIsRefreshing(false);
    }
  }, [address, isConnected, publicClient]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  const decryptBalances = useCallback(async () => {
    if (!instance || !address || !encryptedUsdcBalance || !encryptedZamaBalance) {
      setStatus('Missing encrypted balances');
      return;
    }
    const resolvedSigner = await signerPromise;
    if (!resolvedSigner) {
      setStatus('Wallet signer not available');
      return;
    }

    setIsDecrypting(true);
    setStatus('');
    try {
      const [usdcRes, zamaRes] = await Promise.all([
        decryptHandles({
          instance,
          signer: resolvedSigner,
          userAddress: address as Hex32,
          contractAddress: FUSDC_ADDRESS,
          handles: [encryptedUsdcBalance],
        }),
        decryptHandles({
          instance,
          signer: resolvedSigner,
          userAddress: address as Hex32,
          contractAddress: FZAMA_ADDRESS,
          handles: [encryptedZamaBalance],
        }),
      ]);

      setDecryptedUsdcBalance(usdcRes[encryptedUsdcBalance] ?? null);
      setDecryptedZamaBalance(zamaRes[encryptedZamaBalance] ?? null);
    } catch (e) {
      console.error(e);
      setStatus('Decryption failed');
    } finally {
      setIsDecrypting(false);
    }
  }, [address, encryptedUsdcBalance, encryptedZamaBalance, instance, signerPromise]);

  const mint = useCallback(
    async (token: 'USDC' | 'ZAMA') => {
      if (!address) return;
      const resolvedSigner = await signerPromise;
      if (!resolvedSigner) {
        setStatus('Wallet signer not available');
        return;
      }

      setStatus('');
      try {
        const decimals = 6;
        if (token === 'USDC') {
          const amount = parseUnits(mintUsdc, decimals);
          const contract = new Contract(FUSDC_ADDRESS, FUSDC_ABI, resolvedSigner);
          const tx = await contract.mint(address, amount);
          setStatus(`Minting fUSDC... ${tx.hash}`);
          await tx.wait();
        } else {
          const amount = parseUnits(mintZama, decimals);
          const contract = new Contract(FZAMA_ADDRESS, FZAMA_ABI, resolvedSigner);
          const tx = await contract.mint(address, amount);
          setStatus(`Minting fZama... ${tx.hash}`);
          await tx.wait();
        }
        setStatus('Mint succeeded');
        await refreshBalances();
      } catch (e) {
        console.error(e);
        setStatus('Mint failed');
      }
    },
    [address, mintUsdc, mintZama, refreshBalances, signerPromise],
  );

  const authorize = useCallback(async () => {
    if (!address) return;
    const resolvedSigner = await signerPromise;
    if (!resolvedSigner) {
      setStatus('Wallet signer not available');
      return;
    }

    setStatus('');
    try {
      const until = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
      const usdc = new Contract(FUSDC_ADDRESS, FUSDC_ABI, resolvedSigner);
      const zama = new Contract(FZAMA_ADDRESS, FZAMA_ABI, resolvedSigner);

      const tx1 = await usdc.setOperator(SWAP_ADDRESS, until);
      setStatus(`Authorizing fUSDC... ${tx1.hash}`);
      await tx1.wait();

      const tx2 = await zama.setOperator(SWAP_ADDRESS, until);
      setStatus(`Authorizing fZama... ${tx2.hash}`);
      await tx2.wait();

      setStatus('Authorization succeeded');
    } catch (e) {
      console.error(e);
      setStatus('Authorization failed');
    }
  }, [address, signerPromise]);

  const addLiquidity = useCallback(async () => {
    if (!address || !instance) return;
    const resolvedSigner = await signerPromise;
    if (!resolvedSigner) {
      setStatus('Wallet signer not available');
      return;
    }

    setStatus('');
    try {
      const decimals = 6;
      const usdcAmount = parseUnits(liqUsdc, decimals);
      const zamaAmount = parseUnits(liqZama, decimals);

      const encrypted = await instance
        .createEncryptedInput(SWAP_ADDRESS, address)
        .add64(usdcAmount)
        .add64(zamaAmount)
        .encrypt();

      const swap = new Contract(SWAP_ADDRESS, SWAP_ABI, resolvedSigner);
      const tx = await swap.addLiquidity(encrypted.handles[0], encrypted.handles[1], encrypted.inputProof);
      setStatus(`Adding liquidity... ${tx.hash}`);
      await tx.wait();
      setStatus('Liquidity added');
      await refreshBalances();
    } catch (e) {
      console.error(e);
      setStatus('Add liquidity failed');
    }
  }, [address, instance, liqUsdc, liqZama, refreshBalances, signerPromise]);

  const doSwap = useCallback(async () => {
    if (!address || !instance) return;
    const resolvedSigner = await signerPromise;
    if (!resolvedSigner) {
      setStatus('Wallet signer not available');
      return;
    }

    setStatus('');
    try {
      const decimals = 6;
      const amountIn = parseUnits(swapAmount, decimals);
      const encrypted = await instance.createEncryptedInput(SWAP_ADDRESS, address).add64(amountIn).encrypt();

      const swap = new Contract(SWAP_ADDRESS, SWAP_ABI, resolvedSigner);
      const tx =
        swapDirection === 'USDC_TO_ZAMA'
          ? await swap.swapUSDCForZama(encrypted.handles[0], encrypted.inputProof)
          : await swap.swapZamaForUSDC(encrypted.handles[0], encrypted.inputProof);

      setStatus(`Swapping... ${tx.hash}`);
      await tx.wait();
      setStatus('Swap succeeded');
      await refreshBalances();
    } catch (e) {
      console.error(e);
      setStatus('Swap failed');
    }
  }, [address, instance, refreshBalances, signerPromise, swapAmount, swapDirection]);

  const formattedUsdc = decryptedUsdcBalance === null ? '' : formatUnits(decryptedUsdcBalance, 6);
  const formattedZama = decryptedZamaBalance === null ? '' : formatUnits(decryptedZamaBalance, 6);

  return (
    <div className="swap-app">
      <Header />

      <main className="swap-main">
        <section className="card">
          <h2 className="card-title">Wallet</h2>
          <p className="muted">
            Network: Sepolia
            {zamaError ? ` · Encryption service: ${zamaError}` : isZamaLoading ? ' · Encryption service: loading…' : ''}
          </p>
          <div className="row">
            <button className="button" onClick={() => void refreshBalances()} disabled={!isConnected || isRefreshing}>
              {isRefreshing ? 'Refreshing…' : 'Refresh balances'}
            </button>
            <button
              className="button button-primary"
              onClick={() => void decryptBalances()}
              disabled={!isConnected || isDecrypting || !instance}
            >
              {isDecrypting ? 'Decrypting…' : 'Decrypt balances'}
            </button>
          </div>

          <div className="grid-2">
            <div className="panel">
              <div className="panel-title">fUSDC</div>
              <div className="mono">{encryptedUsdcBalance ?? '—'}</div>
              <div className="value">{formattedUsdc ? `${formattedUsdc} fUSDC` : '—'}</div>
            </div>
            <div className="panel">
              <div className="panel-title">fZama</div>
              <div className="mono">{encryptedZamaBalance ?? '—'}</div>
              <div className="value">{formattedZama ? `${formattedZama} fZama` : '—'}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Setup</h2>
          <p className="muted">Authorize the swap contract as an operator for both tokens.</p>
          <button className="button button-primary" onClick={() => void authorize()} disabled={!isConnected}>
            Authorize tokens
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">Faucet</h2>
          <p className="muted">Mint test tokens to your wallet (token decimals: 6).</p>
          <div className="grid-2">
            <div className="panel">
              <div className="row">
                <input className="input" value={mintUsdc} onChange={(e) => setMintUsdc(e.target.value)} />
                <button className="button" onClick={() => void mint('USDC')} disabled={!isConnected}>
                  Mint fUSDC
                </button>
              </div>
            </div>
            <div className="panel">
              <div className="row">
                <input className="input" value={mintZama} onChange={(e) => setMintZama(e.target.value)} />
                <button className="button" onClick={() => void mint('ZAMA')} disabled={!isConnected}>
                  Mint fZama
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Add Liquidity</h2>
          <p className="muted">Suggested bootstrap ratio: 1 fZama = 2 fUSDC.</p>
          <div className="grid-2">
            <div className="panel">
              <div className="panel-title">fUSDC amount</div>
              <input className="input" value={liqUsdc} onChange={(e) => setLiqUsdc(e.target.value)} />
            </div>
            <div className="panel">
              <div className="panel-title">fZama amount</div>
              <input className="input" value={liqZama} onChange={(e) => setLiqZama(e.target.value)} />
            </div>
          </div>
          <button className="button button-primary" onClick={() => void addLiquidity()} disabled={!isConnected || !instance}>
            Add liquidity
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">Swap</h2>
          <div className="row">
            <select className="select" value={swapDirection} onChange={(e) => setSwapDirection(e.target.value as any)}>
              <option value="USDC_TO_ZAMA">fUSDC → fZama</option>
              <option value="ZAMA_TO_USDC">fZama → fUSDC</option>
            </select>
            <input className="input" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} />
            <button className="button button-primary" onClick={() => void doSwap()} disabled={!isConnected || !instance}>
              Swap
            </button>
          </div>
        </section>

        {status ? (
          <section className="card">
            <div className="status">{status}</div>
          </section>
        ) : null}
      </main>
    </div>
  );
}


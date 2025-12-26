export const FUSDC_ADDRESS = '0xc147ABcc9c9737CA6033b50641dCc49fd03e81D4' as const;
export const FZAMA_ADDRESS = '0x9b0bd98DBa3931B8cFEaC4EAC542BCa40eaE05CD' as const;
export const SWAP_ADDRESS = '0xE86276ebDe5829C44274CF448091eD6Ae45f5ec1' as const;

export const FUSDC_ABI = [
  {
    type: 'function',
    name: 'confidentialBalanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setOperator',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'until', type: 'uint48' },
    ],
    outputs: [],
  },
] as const;

export const FZAMA_ABI = FUSDC_ABI;

export const SWAP_ABI = [
  {
    type: 'function',
    name: 'addLiquidity',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'usdcAmountExt', type: 'bytes32' },
      { name: 'zamaAmountExt', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [
      { name: 'usdcIn', type: 'bytes32' },
      { name: 'zamaIn', type: 'bytes32' },
    ],
  },
  {
    type: 'function',
    name: 'swapUSDCForZama',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'usdcAmountInExt', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [{ name: 'zamaOut', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'swapZamaForUSDC',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'zamaAmountInExt', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [{ name: 'usdcOut', type: 'bytes32' }],
  },
] as const;


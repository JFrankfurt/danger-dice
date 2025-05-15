export const GAME_CONTRACT_ABI = [
  {
    name: "playGame",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "GameResult",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "diceValues", type: "uint256[6]" },
      { indexed: false, name: "won", type: "bool" },
      { indexed: false, name: "payoutAmount", type: "uint256" }, // Amount won, if applicable
      { indexed: false, name: "potAmount", type: "uint256" }, // Current pot status
    ],
  },
] as const;

import Die from "@/components/Die";
import {
  GAME_CONTRACT_ADDRESS_BASE,
  GAME_CONTRACT_ADDRESS_BASE_SEPOLIA,
  USDC_ADDRESS_BASE,
  USDC_ADDRESS_BASE_SEPOLIA,
} from "@/constants/addresses";
import { useCallback, useEffect, useState } from "react";
import { type BaseError } from "viem";
import {
  useAccount,
  useChainId,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import Button from "@/components/Button";

const GAME_CONTRACT_ABI = [
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

const REQUIRED_USDC_AMOUNT = 1n * 10n ** 6n;

export enum GameState {
  initial = "initial",
  connecting = "connecting",
  checkingAllowance = "checkingAllowance",
  approving = "approving",
  approved = "approved",
  sendingDeposit = "sendingDeposit",
  waitingForRollResult = "waitingForRollResult",
  gameOver = "gameOver",
}

type DiceDisplay = [number, number, number, number, number, number];

export default function Home() {
  const { address: playerAddress, isConnected, chainId } = useAccount();
  const currentChainId = useChainId();

  const [diceRolls, setDiceRolls] = useState<DiceDisplay>([1, 1, 1, 1, 1, 1]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameState, setGameState] = useState<GameState>(GameState.initial);
  const [gameMessage, setGameMessage] = useState<string | null>(null);
  const [gameOutcome, setGameOutcome] = useState<{
    won: boolean;
    message: string;
  } | null>(null);

  const gameContractAddress =
    currentChainId === 8453 /* base */
      ? GAME_CONTRACT_ADDRESS_BASE
      : GAME_CONTRACT_ADDRESS_BASE_SEPOLIA;
  const usdcContractAddress =
    currentChainId === 8453 /* base */
      ? USDC_ADDRESS_BASE
      : USDC_ADDRESS_BASE_SEPOLIA;

  // --- Wagmi Hook Instances ---
  const {
    data: approveTxHash,
    writeContractAsync: approveUsdc,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();
  const {
    data: playGameTxHash,
    writeContractAsync: callPlayGame,
    isPending: isPlayGamePending,
    error: playGameError,
  } = useWriteContract();

  const {
    data: approveReceipt,
    isLoading: isWaitingForApproveReceipt,
    isSuccess: isApproveSuccess,
  } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const {
    data: playGameReceipt,
    isLoading: isWaitingForPlayGameReceipt,
    isSuccess: isPlayGameSuccess,
  } = useWaitForTransactionReceipt({ hash: playGameTxHash });

  // --- Event Listener for Game Results ---
  useWatchContractEvent({
    address: gameContractAddress,
    abi: GAME_CONTRACT_ABI,
    eventName: "GameResult",
    onLogs(logs: any[]) {
      logs.forEach((log) => {
        const eventData = log.args;
        if (eventData.player === playerAddress) {
          console.log("GameResult event received:", eventData);
          setIsSpinning(false);
          setDiceRolls(
            eventData.diceValues.map((v: bigint) => Number(v)) as DiceDisplay
          ); // Ensure conversion from BigInt
          if (eventData.won) {
            setGameOutcome({
              won: true,
              message: `You won! Payout: ${eventData.payoutAmount.toString()}`,
            }); // Adjust formatting as needed
          } else {
            setGameOutcome({
              won: false,
              message: `You lost! Current pot: ${eventData.potAmount.toString()}`,
            }); // Adjust formatting
          }
          setGameState(GameState.gameOver);
          setGameMessage(null); // Clear processing messages
        }
      });
    },
    onError(error) {
      console.error("Error watching GameResult event:", error);
      setGameMessage("Error receiving game results. Please check console.");
      setGameState(GameState.initial); // Reset state on error
      setIsSpinning(false);
    },
  });

  // --- Game Logic Callbacks ---
  const handleRoll = useCallback(async () => {
    if (!isConnected || !playerAddress) {
      setGameMessage("Please connect your wallet.");
      // Consider triggering wallet connection modal here
      return;
    }
    setGameState(GameState.sendingDeposit); // UI will show dice spinning from this
    setIsSpinning(true);
    setGameMessage("Preparing to roll...");
    setGameOutcome(null); // Clear previous outcome

    // For now, skipping allowance check and approval for simplicity.
    // In a real scenario, you would check allowance and call `approveUsdc` if needed.
    // const allowance = await readContract(config, { address: usdcContractAddress, abi: USDC_ABI, functionName: 'allowance', args: [playerAddress, gameContractAddress] });
    // if (allowance < REQUIRED_USDC_AMOUNT) { /* initiate approval */ }

    try {
      setGameMessage(
        "Please confirm the transaction in your wallet to deposit $1 USDC and roll."
      );
      await callPlayGame({
        address: gameContractAddress,
        abi: GAME_CONTRACT_ABI,
        functionName: "playGame",
        // value: parseEther("0.0001"), // Example: If contract takes ETH directly for gas or other purposes AND is payable.
        // For sending ERC20 (USDC), the value is part of the approve call and contract interaction, not msg.value here,
        // unless your playGame function itself needs msg.value for some other chain-native currency.
        // The 1 USDC is typically handled by the contract transferring it via `transferFrom` after approval.
        // If `playGame` is payable and *also* expects the USDC amount as msg.value (uncommon for ERC20 interaction),
        // this would need adjustment and careful contract design.
        // For this example, we assume `playGame` handles the USDC transfer internally based on prior approval.
      });
      setGameState(GameState.waitingForRollResult); // Tx submitted, waiting for confirmation and event
      // Message will be updated by useWaitForTransactionReceipt and useWatchContractEvent
    } catch (error) {
      console.error("Error calling playGame:", error);
      setGameMessage(`Error: ${(error as Error).message}`);
      setIsSpinning(false);
      setGameState(GameState.initial);
    }
  }, [isConnected, playerAddress, callPlayGame, gameContractAddress]);

  const handleReset = useCallback(() => {
    setDiceRolls([1, 1, 1, 1, 1, 1]);
    setIsSpinning(false);
    setGameState(GameState.initial);
    setGameMessage(null);
    setGameOutcome(null);
    // Clear tx hashes if needed, though wagmi hooks might handle this
  }, []);

  // --- Effects to manage game state based on transaction status ---
  useEffect(() => {
    if (isApprovePending) {
      setGameState(GameState.approving);
      setGameMessage("Approving USDC spend. Please confirm in your wallet...");
    } else if (approveTxHash && isWaitingForApproveReceipt) {
      setGameState(GameState.approving); // Or a more specific "approvalSubmitted"
      setGameMessage(
        `Approving USDC... Tx: ${approveTxHash.substring(0, 10)}...`
      );
    }
  }, [isApprovePending, approveTxHash, isWaitingForApproveReceipt]);

  useEffect(() => {
    if (isPlayGamePending) {
      setGameState(GameState.sendingDeposit);
      setGameMessage("Confirming deposit in your wallet...");
    } else if (playGameTxHash && isWaitingForPlayGameReceipt) {
      setGameState(GameState.sendingDeposit); // Or a more specific "depositSubmitted"
      setGameMessage(
        `Depositing $1 USDC... Tx: ${playGameTxHash.substring(0, 10)}...`
      );
    }
  }, [isPlayGamePending, playGameTxHash, isWaitingForPlayGameReceipt]);

  useEffect(() => {
    if (isApproveSuccess && approveReceipt) {
      setGameMessage("USDC Approved! Ready to deposit.");
      setGameState(GameState.approved);
      // TODO: Potentially auto-trigger the deposit here or guide user to click Roll again.
      // For now, we assume user needs to click Roll again if approval was a separate step.
    }
    if (approveError) {
      setGameMessage(
        `Approval Error: ${
          (approveError as BaseError).shortMessage || approveError.message
        }`
      );
      setGameState(GameState.initial);
      setIsSpinning(false);
    }
  }, [isApproveSuccess, approveReceipt, approveError]);

  useEffect(() => {
    if (isPlayGameSuccess && playGameReceipt) {
      setGameMessage(
        "Deposit successful! Waiting for dice roll results from the contract..."
      );
      setGameState(GameState.waitingForRollResult);
      // isSpinning should already be true. Event listener will handle the rest.
    }
    if (playGameError) {
      setGameMessage(
        `Play Game Error: ${
          (playGameError as BaseError).shortMessage || playGameError.message
        }`
      );
      setGameState(GameState.initial);
      setIsSpinning(false);
    }
  }, [isPlayGameSuccess, playGameReceipt, playGameError]);

  // Initial message based on connection
  useEffect(() => {
    if (!isConnected) {
      setGameMessage("Connect your wallet to play.");
      setGameState(GameState.connecting);
    } else {
      if (
        gameState === GameState.connecting ||
        gameState === GameState.initial
      ) {
        // only reset if coming from disconnected
        setGameMessage("Wallet connected. Click Roll to play!");
        setGameState(GameState.initial);
      }
    }
  }, [isConnected, gameState]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-4">
      <div className="mb-4 p-3 rounded-md bg-white shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-indigo-600 mb-2">Danger Dice</h1>
        {gameMessage && (
          <p className="text-sm text-gray-700 italic">{gameMessage}</p>
        )}
        {gameOutcome && (
          <p
            className={`text-lg font-semibold ${
              gameOutcome.won ? "text-green-500" : "text-red-500"
            }`}
          >
            {gameOutcome.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-6">
        {diceRolls.map((roll, index) => (
          <Die
            key={index}
            targetRoll={roll}
            isSpinning={isSpinning && gameState !== GameState.gameOver} // Stop spinning visually once game is over
            initialDisplayValue={1} // All dice start at 1 (single dot)
            onAnimationComplete={() => {
              // This might not be needed if isSpinning controls everything
              // If individual dice animations need to signal completion, can be used
            }}
          />
        ))}
      </div>

      <div className="flex space-x-4">
        <Button
          onClick={handleRoll}
          disabled={
            !isConnected ||
            isApprovePending ||
            isPlayGamePending ||
            isWaitingForApproveReceipt ||
            isWaitingForPlayGameReceipt ||
            gameState === GameState.waitingForRollResult ||
            isSpinning
          }
          variant="primary"
          size="medium"
        >
          {isApprovePending
            ? "Approving..."
            : isWaitingForApproveReceipt
            ? "Approving..."
            : isPlayGamePending
            ? "Confirming..."
            : isWaitingForPlayGameReceipt
            ? "Depositing..."
            : gameState === GameState.waitingForRollResult
            ? "Rolling..."
            : "Roll Dice"}
        </Button>

        <Button
          onClick={handleReset}
          disabled={
            isApprovePending ||
            isPlayGamePending ||
            isWaitingForApproveReceipt ||
            isWaitingForPlayGameReceipt ||
            gameState === GameState.waitingForRollResult
          }
          variant="secondary"
          size="medium"
        >
          Reset
        </Button>
      </div>

      {/* Optional: Display raw transaction hashes or errors for debugging */}
      {approveTxHash && (
        <p className="text-xs mt-2">Approve Tx: {approveTxHash}</p>
      )}
      {playGameTxHash && (
        <p className="text-xs mt-2">Play Tx: {playGameTxHash}</p>
      )}
      {approveError && (
        <p className="text-xs mt-2 text-red-500">
          Approve Error: {approveError.message}
        </p>
      )}
      {playGameError && (
        <p className="text-xs mt-2 text-red-500">
          Play Error: {playGameError.message}
        </p>
      )}
    </div>
  );
}

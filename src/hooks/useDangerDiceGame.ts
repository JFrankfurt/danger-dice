import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { GAME_CONTRACT_ABI } from "@/abi/game";
import {
  GAME_CONTRACT_ADDRESS_BASE,
  GAME_CONTRACT_ADDRESS_BASE_SEPOLIA,
  USDC_ADDRESS_BASE,
  USDC_ADDRESS_BASE_SEPOLIA,
} from "@/constants/addresses";
import { REQUIRED_USDC_AMOUNT } from "@/constants/game";
import { GameState, DiceDisplay } from "@/types/game";
import { type BaseError } from "viem";

export function useDangerDiceGame() {
  const { address: playerAddress, isConnected } = useAccount();
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
          setIsSpinning(false);
          setDiceRolls(
            eventData.diceValues.map((v: bigint) => Number(v)) as DiceDisplay
          );
          if (eventData.won) {
            setGameOutcome({
              won: true,
              message: `You won! Payout: ${eventData.payoutAmount.toString()}`,
            });
          } else {
            setGameOutcome({
              won: false,
              message: `You lost! Current pot: ${eventData.potAmount.toString()}`,
            });
          }
          setGameState(GameState.gameOver);
          setGameMessage(null);
        }
      });
    },
    onError(error) {
      setGameMessage("Error receiving game results. Please check console.");
      setGameState(GameState.initial);
      setIsSpinning(false);
    },
  });

  // --- Game Logic Callbacks ---
  const handleRoll = useCallback(async () => {
    if (!isConnected || !playerAddress) {
      setGameMessage("Please connect your wallet.");
      return;
    }
    setGameState(GameState.sendingDeposit);
    setIsSpinning(true);
    setGameMessage("Preparing to roll...");
    setGameOutcome(null);
    try {
      setGameMessage(
        "Please confirm the transaction in your wallet to deposit $1 USDC and roll."
      );
      await callPlayGame({
        address: gameContractAddress,
        abi: GAME_CONTRACT_ABI,
        functionName: "playGame",
      });
      setGameState(GameState.waitingForRollResult);
    } catch (error) {
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
  }, []);

  // --- Effects to manage game state based on transaction status ---
  useEffect(() => {
    if (isApprovePending) {
      setGameState(GameState.approving);
      setGameMessage("Approving USDC spend. Please confirm in your wallet...");
    } else if (approveTxHash && isWaitingForApproveReceipt) {
      setGameState(GameState.approving);
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
      setGameState(GameState.sendingDeposit);
      setGameMessage(
        `Depositing $1 USDC... Tx: ${playGameTxHash.substring(0, 10)}...`
      );
    }
  }, [isPlayGamePending, playGameTxHash, isWaitingForPlayGameReceipt]);

  useEffect(() => {
    if (isApproveSuccess && approveReceipt) {
      setGameMessage("USDC Approved! Ready to deposit.");
      setGameState(GameState.approved);
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

  useEffect(() => {
    if (!isConnected) {
      setGameMessage("Connect your wallet to play.");
      setGameState(GameState.connecting);
    } else {
      if (
        gameState === GameState.connecting ||
        gameState === GameState.initial
      ) {
        setGameMessage("Wallet connected. Click Roll to play!");
        setGameState(GameState.initial);
      }
    }
  }, [isConnected, gameState]);

  return {
    diceRolls,
    isSpinning,
    gameState,
    gameMessage,
    gameOutcome,
    handleRoll,
    handleReset,
    isConnected,
    isApprovePending,
    isPlayGamePending,
    isWaitingForApproveReceipt,
    isWaitingForPlayGameReceipt,
  };
}

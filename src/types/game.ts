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

export type DiceDisplay = [number, number, number, number, number, number];

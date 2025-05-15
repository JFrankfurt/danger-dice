import React, { useState, useEffect, useRef } from "react";

interface DieProps {
  targetRoll: number | null;
  isSpinning: boolean; // True to initiate rapid spin phase
  onAnimationComplete?: () => void;
  initialDisplayValue?: number | string; // e.g., 1 or '?'
}

const MAX_DICE_ROLL = 6;
const DICE_SPEED_FAST_MS = 75;
const DICE_SLOWDOWN_STEPS = 4; // Number of "slowing" ticks before landing on target
const DICE_SLOWDOWN_INITIAL_INTERVAL_MS = 100;
const DICE_SLOWDOWN_INTERVAL_INCREMENT_MS = 75; // Each step gets this much slower
const DICE_FINAL_HOLD_MS = 500; // Hold on targetRoll for this long

// Helper component to render dice dots
const DiceDots = ({ value }: { value: number | string }) => {
  if (typeof value === "string" || value < 1 || value > 6) {
    return <>{typeof value === "string" ? value : "?"}</>;
  }

  // Standard die face patterns (which cells in a 3x3 grid should be a dot)
  // Grid cells are 0-indexed: (row, col)
  // (0,0) (0,1) (0,2)
  // (1,0) (1,1) (1,2)
  // (2,0) (2,1) (2,2)
  const patterns: { [key: number]: Array<[number, number]> } = {
    1: [[1, 1]], // Center
    2: [
      [0, 0],
      [2, 2],
    ], // Top-left, Bottom-right
    3: [
      [0, 0],
      [1, 1],
      [2, 2],
    ], // Top-left, Center, Bottom-right
    4: [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ], // Corners
    5: [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ], // Corners + Center
    6: [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 2],
    ], // Two columns (no middle column dots)
  };

  const currentPattern = patterns[value];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        width: "60px",
        height: "60px",
        gap: "4px", // Reduced gap slightly
      }}
    >
      {Array.from({ length: 9 }).map((_, index) => {
        const r = Math.floor(index / 3); // 0, 1, 2 (row)
        const c = index % 3; // 0, 1, 2 (col)

        const showDot = currentPattern.some((p) => p[0] === r && p[1] === c);

        // Special handling for 6 to make it two vertical lines of 3 dots
        // The pattern for 6 above needs to be interpreted as cells (0,0), (1,0), (2,0) and (0,2), (1,2), (2,2)
        let showDotForSix = false;
        if (value === 6) {
          const sixPatternSpecific = [
            [0, 0],
            [1, 0],
            [2, 0],
            [0, 2],
            [1, 2],
            [2, 2],
          ];
          showDotForSix = sixPatternSpecific.some(
            (p) => p[0] === r && p[1] === c
          );
        }

        return (
          <div
            key={index}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {(value === 6 ? showDotForSix : showDot) && (
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: "#333",
                  borderRadius: "50%",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function Die({
  targetRoll,
  isSpinning,
  onAnimationComplete,
  initialDisplayValue = "?",
}: DieProps) {
  const [displayNumber, setDisplayNumber] = useState<number | string>(
    initialDisplayValue
  );

  const rapidSpinIntervalRef = useRef<number | null>(null);
  const slowdownTimeoutRef = useRef<number | null>(null);
  const slowdownStepCounterRef = useRef<number>(0);

  useEffect(() => {
    const clearTimers = () => {
      if (rapidSpinIntervalRef.current) {
        clearInterval(rapidSpinIntervalRef.current);
        rapidSpinIntervalRef.current = null;
      }
      if (slowdownTimeoutRef.current) {
        clearTimeout(slowdownTimeoutRef.current);
        slowdownTimeoutRef.current = null;
      }
      slowdownStepCounterRef.current = 0;
    };

    if (isSpinning && targetRoll === null) {
      clearTimers();
      setDisplayNumber(Math.floor(Math.random() * MAX_DICE_ROLL) + 1);
      rapidSpinIntervalRef.current = window.setInterval(() => {
        setDisplayNumber(Math.floor(Math.random() * MAX_DICE_ROLL) + 1);
      }, DICE_SPEED_FAST_MS);
    } else if (
      targetRoll !== null &&
      (rapidSpinIntervalRef.current !== null || isSpinning)
    ) {
      if (rapidSpinIntervalRef.current) {
        clearInterval(rapidSpinIntervalRef.current);
        rapidSpinIntervalRef.current = null;
      }

      if (slowdownTimeoutRef.current) {
        clearTimeout(slowdownTimeoutRef.current);
      }
      slowdownStepCounterRef.current = 0;

      const performSlowdownStep = () => {
        if (slowdownStepCounterRef.current < DICE_SLOWDOWN_STEPS) {
          setDisplayNumber(Math.floor(Math.random() * MAX_DICE_ROLL) + 1);
          slowdownStepCounterRef.current++;
          const nextInterval =
            DICE_SLOWDOWN_INITIAL_INTERVAL_MS +
            (slowdownStepCounterRef.current - 1) *
              DICE_SLOWDOWN_INTERVAL_INCREMENT_MS;
          slowdownTimeoutRef.current = window.setTimeout(
            performSlowdownStep,
            nextInterval
          );
        } else {
          setDisplayNumber(targetRoll);
          slowdownTimeoutRef.current = window.setTimeout(() => {
            if (onAnimationComplete) {
              onAnimationComplete();
            }
          }, DICE_FINAL_HOLD_MS);
        }
      };
      slowdownTimeoutRef.current = window.setTimeout(
        performSlowdownStep,
        DICE_SLOWDOWN_INITIAL_INTERVAL_MS
      );
    } else if (!isSpinning && targetRoll === null) {
      clearTimers();
      setDisplayNumber(initialDisplayValue);
    } else if (!isSpinning && targetRoll !== null) {
      clearTimers();
      setDisplayNumber(targetRoll);
    }

    return clearTimers;
  }, [isSpinning, targetRoll, onAnimationComplete, initialDisplayValue]);

  return (
    <div
      style={{
        width: "80px",
        height: "80px",
        border: "2px solid #333",
        borderRadius: "10px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "40px",
        fontWeight: "bold",
        color: "#333",
        backgroundColor: "#f0f0f0",
        boxShadow: "2px 2px 5px rgba(0,0,0,0.1)",
        userSelect: "none",
      }}
    >
      {typeof displayNumber === "number" ? (
        <DiceDots value={displayNumber} />
      ) : (
        displayNumber
      )}
    </div>
  );
}

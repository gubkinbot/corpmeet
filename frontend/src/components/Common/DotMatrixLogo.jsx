import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "../../contexts/ThemeContext";

const LETTERS = {
  C:[[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  O:[[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  R:[[1,1,1,1,0],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,1,0],[1,0,0,0,1]],
  P:[[1,1,1,1,0],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0]],
  M:[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  E:[[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,1,1,1,1]],
  T:[[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
};

const WORD = ["C","O","R","P","M","E","E","T"];
const DOT_R = 1.8;
const GAP = 4.5;
const LETTER_GAP = 5;

export function DotMatrixLogo() {
  const canvasRef = useRef(null);
  const { isDark } = useTheme();

  const buildDots = useCallback(() => {
    const darkColor = isDark ? "#f8fafc" : "#1a1a1a";
    const accentColor = "#4f46e5";
    const colors = [darkColor,darkColor,darkColor,darkColor,accentColor,accentColor,accentColor,accentColor];
    const dots = [];
    let ox = 4;
    for (let w = 0; w < WORD.length; w++) {
      const mat = LETTERS[WORD[w]];
      for (let row = 0; row < mat.length; row++) {
        for (let col = 0; col < mat[row].length; col++) {
          if (mat[row][col]) {
            dots.push({
              homeX: ox + col * GAP, homeY: DOT_R + row * GAP,
              color: colors[w],
            });
          }
        }
      }
      ox += mat[0].length * GAP + LETTER_GAP;
    }
    return dots;
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dots = buildDots();

    const maxX = Math.max(...dots.map(d => d.homeX)) + DOT_R + 1;
    const maxY = Math.max(...dots.map(d => d.homeY)) + DOT_R + 1;
    canvas.width = Math.ceil(maxX);
    canvas.height = Math.ceil(maxY);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(d.homeX, d.homeY, DOT_R, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
    }
  }, [buildDots]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: 22, width: "auto", display: "block" }}
    />
  );
}

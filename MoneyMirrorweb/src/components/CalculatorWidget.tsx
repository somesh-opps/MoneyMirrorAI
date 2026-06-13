import { useState, useEffect, useRef } from "react";
import { Calculator, X, History, Trash2 } from "lucide-react";

interface CalculationRecord {
  id: string;
  expression: string;
  result: string;
  timestamp: number;
}

export function CalculatorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [history, setHistory] = useState<CalculationRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load history from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("moneymirror_calc_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save history to local storage when it changes
  useEffect(() => {
    localStorage.setItem("moneymirror_calc_history", JSON.stringify(history));
  }, [history]);

  // Handle clicks outside the widget to close it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Prevent closing if they clicked the toggle button
        const isToggleButton = (e.target as Element).closest("#calc-toggle-btn");
        if (!isToggleButton) setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleNum = (num: string) => {
    if (display === "0" || display === "Error") {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOp = (op: string) => {
    if (display === "Error") return;
    setExpression(display + " " + op + " ");
    setDisplay("0");
  };

  const calculate = () => {
    if (!expression || display === "Error") return;
    try {
      const fullExp = expression + display;
      // Replace safe operators for eval
      const sanitized = fullExp.replace(/×/g, "*").replace(/÷/g, "/");
      // eslint-disable-next-line no-new-func
      const res = new Function(`return ${sanitized}`)();
      const rounded = Math.round(res * 100) / 100; // Round to 2 decimals
      const resultStr = String(rounded);
      
      const newRecord: CalculationRecord = {
        id: Math.random().toString(36).substr(2, 9),
        expression: fullExp.replace(/\*/g, "×").replace(/\//g, "÷"),
        result: resultStr,
        timestamp: Date.now(),
      };
      
      setHistory((prev) => [newRecord, ...prev].slice(0, 20)); // Keep last 20
      setDisplay(resultStr);
      setExpression("");
    } catch (err) {
      setDisplay("Error");
      setExpression("");
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setExpression("");
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <>
      <button
        id="calc-toggle-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-[98px] right-[28px] z-[9998] flex h-[58px] w-[58px] items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_8px_32px_rgba(var(--accent),0.45)] transition-all hover:scale-110 active:scale-95"
        title="Open Calculator"
      >
        <Calculator className="h-[24px] w-[24px] text-white" />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-[164px] right-[28px] z-[9999] flex w-72 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-elevated"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-accent" />
              <span className="font-semibold">Calculator</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`rounded-md p-1.5 transition-colors ${showHistory ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
                title="History"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showHistory ? (
            <div className="flex h-[320px] flex-col">
              <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/10">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</span>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-xs text-destructive hover:underline flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No calculations yet.
                  </div>
                ) : (
                  history.map((record) => (
                    <div key={record.id} className="rounded-lg bg-muted/40 p-3 text-right group relative">
                       <button 
                        onClick={() => {
                          setDisplay(record.result);
                          setShowHistory(false);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 bg-background/80 flex items-center justify-center text-xs font-semibold backdrop-blur-[1px] transition-opacity"
                      >
                        Use Result
                      </button>
                      <div className="text-xs text-muted-foreground">{record.expression} =</div>
                      <div className="font-mono text-lg font-bold text-foreground">{record.result}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-4">
              {/* Display */}
              <div className="mb-4 flex h-20 flex-col items-end justify-end rounded-xl bg-muted/50 p-3 text-right font-mono">
                <div className="text-sm text-muted-foreground min-h-[20px]">{expression}</div>
                <div className={`text-3xl font-bold tracking-tight ${display === "Error" ? "text-destructive" : ""}`}>
                  {display}
                </div>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-4 gap-2">
                <CalcBtn onClick={handleClear} label="C" className="bg-destructive/10 text-destructive hover:bg-destructive/20 font-bold" />
                <CalcBtn onClick={() => handleOp("/")} label="÷" className="bg-accent/10 text-accent font-bold text-lg" />
                <CalcBtn onClick={() => handleOp("*")} label="×" className="bg-accent/10 text-accent font-bold text-lg" />
                <CalcBtn onClick={() => {
                    if (display.length > 1 && display !== "Error") {
                      setDisplay(display.slice(0, -1));
                    } else {
                      setDisplay("0");
                    }
                  }} label="⌫" className="bg-muted hover:bg-muted/80 text-muted-foreground" />
                
                <CalcBtn onClick={() => handleNum("7")} label="7" />
                <CalcBtn onClick={() => handleNum("8")} label="8" />
                <CalcBtn onClick={() => handleNum("9")} label="9" />
                <CalcBtn onClick={() => handleOp("-")} label="−" className="bg-accent/10 text-accent font-bold text-lg" />
                
                <CalcBtn onClick={() => handleNum("4")} label="4" />
                <CalcBtn onClick={() => handleNum("5")} label="5" />
                <CalcBtn onClick={() => handleNum("6")} label="6" />
                <CalcBtn onClick={() => handleOp("+")} label="+" className="bg-accent/10 text-accent font-bold text-lg" />
                
                <div className="col-span-3 grid grid-cols-3 gap-2">
                  <CalcBtn onClick={() => handleNum("1")} label="1" />
                  <CalcBtn onClick={() => handleNum("2")} label="2" />
                  <CalcBtn onClick={() => handleNum("3")} label="3" />
                  <CalcBtn onClick={() => handleNum("0")} label="0" className="col-span-2" />
                  <CalcBtn onClick={() => {
                    if (!display.includes(".")) handleNum(".");
                  }} label="." className="font-bold" />
                </div>
                <div className="col-span-1">
                  <button
                    onClick={calculate}
                    className="flex h-full w-full items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 font-bold text-xl"
                  >
                    =
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CalcBtn({ onClick, label, className = "" }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-12 items-center justify-center rounded-xl bg-background border border-border shadow-sm text-foreground transition-colors hover:bg-muted ${className}`}
    >
      {label}
    </button>
  );
}

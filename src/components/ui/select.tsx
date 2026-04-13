"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useUiSound } from "@/hooks/use-ui-sound";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  className,
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { playSound } = useUiSound();

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) playSound("pop");
    setIsOpen(!isOpen);
  };

  const handleSelect = (val: string) => {
    playSound("click");
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all duration-200 ease-out",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          disabled ? "cursor-not-allowed opacity-50 bg-surface-2/50" : "cursor-pointer",
          isOpen
            ? "border-primary bg-surface shadow-[0_0_10px_rgba(34,197,94,0.15)] ring-1 ring-primary/20"
            : "border-border bg-surface-2 hover:border-border/80 hover:bg-surface-2/80",
          "text-foreground"
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-muted")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 text-muted transition-transform duration-200",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full rounded-lg border border-border/50 bg-[#0F172A] p-1 shadow-[0_8px_30px_rgb(0,0,0,0.4)] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ease-out backdrop-blur-xl">
          <ul className="max-h-60 w-full overflow-auto rounded-md py-1 text-sm focus:outline-none">
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 transition-colors duration-150 ease-out text-slate-200",
                  "hover:bg-[#1E293B] hover:text-white",
                  value === option.value && "bg-primary/20 text-primary font-medium hover:bg-primary/30"
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {value === option.value && (
                    <Check className="h-4 w-4 animate-in fade-in zoom-in-75 duration-200 ease-out" />
                  )}
                </span>
                <span className="truncate">{option.label}</span>
              </li>
            ))}
            {options.length === 0 && (
              <li className="py-2 px-3 text-center text-muted">Nenhuma opção</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

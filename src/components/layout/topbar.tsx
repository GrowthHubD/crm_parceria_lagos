"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, Menu } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { useUiSound } from "@/hooks/use-ui-sound";
import { cn } from "@/lib/utils";

interface TopbarProps {
  userName: string;
  userImage: string | null | undefined;
  onMenuClick: () => void;
}

export function Topbar({ userName, userImage, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellRinging, setBellRinging] = useState(false);
  const prevUnread = useRef(0);
  const { playSound } = useUiSound();

  useEffect(() => {
    let mounted = true;

    async function fetchUnread() {
      try {
        const res = await fetch("/api/notificacoes?unread=true");
        if (res.ok && mounted) {
          const data = await res.json();
          const count = data.unreadCount ?? 0;
          if (count > prevUnread.current) {
            playSound("notification");
            setBellRinging(true);
            setTimeout(() => setBellRinging(false), 700);
          }
          prevUnread.current = count;
          setUnreadCount(count);
        }
      } catch {
        // ignore
      }
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [playSound]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 h-[var(--topbar-height)] bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-muted hover:text-foreground transition-colors cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Breadcrumbs />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications bell with badge */}
        <button
          onClick={() => { playSound("pop"); router.push("/notificacoes"); }}
          className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors duration-200 cursor-pointer"
          aria-label="Notificações"
        >
          <Bell className={cn("w-5 h-5 transition-transform", bellRinging && "animate-bell-ring")} />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute top-1 right-1 flex items-center justify-center",
              "w-4 h-4 rounded-full bg-error text-white text-[10px] font-bold leading-none",
              "animate-glow-pulse"
            )}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User avatar + logout */}
        <div className="flex items-center gap-2 ml-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt={userName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <span className="hidden sm:block text-sm text-foreground font-medium max-w-[120px] truncate">
            {userName}
          </span>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors duration-200 cursor-pointer"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

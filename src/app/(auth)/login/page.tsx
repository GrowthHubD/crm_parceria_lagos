"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError("Email ou senha inválidos. Tente novamente.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Erro ao conectar. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Logo */}
      <div className="flex justify-center mb-10">
        <Image
          src="/images/logo-full.png"
          alt="Growth Hub"
          width={220}
          height={48}
          priority
          className="brightness-0 invert"
        />
      </div>

      {/* Card */}
      <div className="bg-surface rounded-xl border border-border p-8">
        <div className="mb-6">
          <h1 className="text-h2 text-foreground">Entrar</h1>
          <p className="text-muted mt-1 text-small">
            Acesse o painel de gestão da Growth Hub
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-small animate-card-entrance">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="text-label block mb-2"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="text-label block mb-2"
            >
              Senha
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-background border border-border text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors duration-200 cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold transition-all duration-200 hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-muted text-small mt-6">
        Growth Hub Manager &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}

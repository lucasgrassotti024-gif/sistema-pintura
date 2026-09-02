"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("E-mail ou senha incorretos. Verifique suas credenciais.");
        } else if (error.message.includes("Email not confirmed")) {
          setErrorMessage("E-mail ainda não confirmado no sistema.");
        } else {
          setErrorMessage(error.message);
        }
        setIsLoading(false);
        return;
      }

      // Redirecionamento após autenticação bem-sucedida
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Ocorreu um erro inesperado ao tentar entrar. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070c14] flex flex-col items-center justify-center p-4 sm:p-6 relative">
      <div className="max-w-md w-full bg-[#0c1524] border border-blue-500/20 rounded-xl p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-500 font-extrabold text-xl mb-1 shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)]">
            RSS3
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            SOLUÇÕES INDUSTRIAIS
          </h1>
          <p className="text-xs text-blue-400 font-mono uppercase tracking-wider">
            Gestão Operacional de Pintura Industrial
          </p>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="p-3 text-xs bg-rose-500/10 text-rose-300 border border-rose-500/30 rounded-lg font-medium font-mono">
            {errorMessage}
          </div>
        )}

        {/* Formulário de Login */}
        <form
          id="login-form"
          name="login"
          method="post"
          onSubmit={handleLogin}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-200 mb-1"
            >
              E-mail de Acesso *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@rss3.com.br"
              className="w-full text-sm bg-[#070c14] text-white border border-blue-500/25 rounded-lg px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 focus:outline-hidden transition-all placeholder:text-slate-500"
              required
              disabled={isLoading}
              autoComplete="username email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-200 mb-1"
            >
              Senha *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-sm bg-[#070c14] text-white border border-blue-500/25 rounded-lg px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 focus:outline-hidden transition-all placeholder:text-slate-500"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 px-4 text-xs font-bold text-white rounded-lg transition-all shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] ${
              isLoading
                ? "bg-orange-500/50 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 active:scale-[0.99]"
            }`}
          >
            {isLoading ? "Validando credenciais..." : "Entrar no Sistema"}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-blue-500/15">
          <p className="text-[11px] text-slate-400 font-mono">
            Acesso operacional protegido por autenticação segura RSS3.
          </p>
        </div>
      </div>
    </main>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

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
    } catch (err) {
      setErrorMessage("Ocorreu um erro inesperado ao tentar entrar. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 relative">
      {/* Botão de Tema no Canto Superior */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-lg mb-1 shadow-xs">
            SP
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Sistema de Pintura Industrial
          </h1>
          <p className="text-xs text-slate-500">
            Acesso operacional restrito para equipes e coordenação.
          </p>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium">
            {errorMessage}
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail de Acesso *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@empresa.com"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Senha *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 px-4 text-xs font-bold text-white rounded-lg shadow-xs transition-colors ${
              isLoading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
            }`}
          >
            {isLoading ? "Validando credenciais..." : "Entrar no Sistema"}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-slate-100">
          <p className="text-[11px] text-slate-400">
            Acesso protegido por autenticação segura Supabase Auth.
          </p>
        </div>
      </div>
    </main>
  );
}

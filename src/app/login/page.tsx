"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { refreshProfileAndPermissions } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      await refreshProfileAndPermissions();
      router.push("/pintura");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Falha na autenticação. Verifique os dados inseridos.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070c14] flex flex-col justify-center items-center p-4">
      {/* Container Principal do Card de Login */}
      <div className="w-full max-w-md bg-[#0c1524] border border-blue-500/20 rounded-xl p-8 shadow-2xl space-y-6">
        {/* Cabeçalho com Logotipo RSS3 Soluções Industriais */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500 text-white font-mono font-bold text-xl shadow-[0_0_20px_rgba(249,115,22,0.4)] mx-auto">
            R3
          </div>
          <div className="pt-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              RSS3 Soluções Industriais
            </h1>
            <p className="text-xs text-orange-400 font-semibold tracking-wider uppercase font-mono mt-0.5">
              Sistema de Pintura Industrial
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Acesso restrito para equipe operacional e gestão técnica.
          </p>
        </div>

        {/* Mensagem de Erro de Autenticação */}
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-md font-medium font-mono">
            {errorMsg}
          </div>
        )}

        {/* Formulário de Autenticação */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
              E-mail Corporativo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operador@rss3.com.br"
              className="w-full text-xs bg-[#070c14] border border-blue-500/20 rounded-md px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
              Senha de Acesso
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs bg-[#070c14] border border-blue-500/20 rounded-md px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-xs font-bold py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-md transition-all shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Validando Acesso...</span>
              </>
            ) : (
              <span>Entrar no Sistema</span>
            )}
          </button>
        </form>

        {/* Rodapé do Card */}
        <div className="text-center pt-2 border-t border-blue-500/10">
          <span className="text-[11px] text-slate-400 font-mono">
            Plataforma Operacional • RSS3 Engenharia
          </span>
        </div>
      </div>
    </div>
  );
}

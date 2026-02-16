import { useState } from "react";
import { loginUser } from "@/services/Auth";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay"; // ou "@/components/overlays"

export function LoginModal({ onSwitch, onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await loginUser({ email, senha: password });

      if (result?.token) {
        onLoggedIn(result.token);
        // não precisa setIsSubmitting(false) aqui, porque a tela vai trocar
        // mas deixo no finally para caso não troque por algum motivo
      } else {
        alert(result?.error || "Erro ao logar");
      }
    } catch (error) {
      console.error("Erro ao logar:", error);
      alert("Erro ao logar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {isSubmitting && <LoadingOverlay message="Entrando..." />}

      <div className="auth-modal">
        <h2>Login</h2>

        <div className="input-group">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="input-group">
          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <button className="auth-button" onClick={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>

        <p className="switch-mode" onClick={isSubmitting ? undefined : onSwitch}>
          Ainda não tem conta? <span className="link-text">Registre-se</span>
        </p>
      </div>
    </>
  );
}

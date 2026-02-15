import { useState } from "react";
import { loginUser } from "@/services/Auth";

export function LoginModal({ onSwitch, onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {

      try {
          const result = await loginUser({ email, senha: password });

          if(result.token) {
            onLoggedIn(result.token);

          } else {
            alert(result.error || "Erro ao logar");
          }


      } catch (error) {
          console.error("Erro ao logar:", error);
          alert("Erro ao logar. Tente novamente.")
      }
  }


  return (
    <div className="auth-modal">
      <h2>Login</h2>
      <div className="input-group">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          placeholder="Seu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        />
      </div>

      <button className="auth-button" onClick={ handleLogin }>Entrar</button>


      <p className="switch-mode" onClick={onSwitch}>
        Ainda não tem conta? <span className="link-text">Registre-se</span>
      </p>
    </div>
  );

}
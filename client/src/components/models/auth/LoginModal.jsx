export function LoginModal({ onSwitch }) {

  return (
    <div className="auth-modal">
      <h2>Login</h2>
      <div className="input-group">
        <label htmlFor="login-email">Email</label>
        <input id="login-email" placeholder="Seu email" />
      </div>
      <div className="input-group">
        <label htmlFor="login-password">Senha</label>
        <input id="login-password" type="password" placeholder="Sua senha" />
      </div>
      <button className="auth-button">Entrar</button>


      <p className="switch-mode" onClick={onSwitch}>
        Ainda não tem conta? <span className="link-text">Registre-se</span>
      </p>
    </div>
  );

}
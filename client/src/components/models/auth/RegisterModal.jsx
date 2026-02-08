import { useState } from "react";
import { registerUser } from "../../../service/auth";


export function RegisterModal({onSwitch}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [nome, setNome] = useState("");

    async function handleRegister() {

        try {
            await registerUser({ nome, email, password });
            alert ("Registro enviado para o servidor");

            onSwitch();
        } catch (error) {
            console.error("Erro ao registrar:", error);
            alert("Erro ao registrar. Tente novamente.")
        }
    }

    return (
        <div className="auth-modal">
        <h2>Registro</h2>


        <div className="input-group">
            <label htmlFor="register-email">Nome</label>
            <input
            id="register-nome"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            />
        </div>


        <div className="input-group">
            <label htmlFor="register-email">Email</label>
            <input
            id="register-email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            />
        </div>


        <div className="input-group">
            <label htmlFor="register-password">Senha</label>
            <input
            id="register-password"
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            />
        </div>


        <button className="auth-button" onClick={handleRegister}>
            Criar conta
        </button>


        <p className="switch-mode" onClick={onSwitch}>
            Já tem conta? <span className="link-text">Fazer login</span>
        </p>
        </div>
    );

}
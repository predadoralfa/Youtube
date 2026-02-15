import { LoginModal, RegisterModal } from "@/components/models/auth/";
import { useState } from "react"
import "@/style/auth.css"

export function AuthPage({ onLoggedIn }) {
    const [mode, setModo] = useState("login");

    return (
        <div className="auth-container">
            <div className="auth-background"></div>
            <div className="auth-modal-wrapper">
                { mode === "login" ? (
                    <LoginModal onSwitch={ () => setModo("register")}
                        onLoggedIn={onLoggedIn}
                    />
                ) : (
                    <RegisterModal onSwitch={ () => setModo("login")}
                        onLoggedIn={onLoggedIn}
                    />
                )} 
            </div>
        </div> 
    )
}


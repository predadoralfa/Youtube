import { LoginModal } from "@/components/models/auth/LoginModal";
import { RegisterModal } from "@/components/models/auth/RegisterModal";
import { useState } from "react"
import "@/style/auth.css"

export function AuthPage() {
    const [mode, setModo] = useState("login");

    return (
        <div className="auth-container">
            <div className="auth-background"></div>
            <div className="auth-modal-wrapper">
                { mode === "login" ? (
                    <LoginModal onSwitch={ () => setModo("register")}/>
                ) : (
                    <RegisterModal onSwitch={ () => setModo("login")}/>
                )} 
            </div>
        </div> 
    )
}


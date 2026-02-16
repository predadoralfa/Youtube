import { useEffect, useState } from "react";
import { AuthPage } from "@/pages/AuthPage";
import { GameShell } from "@/World/GameShell";

export function WorldRoot() {
    const [hasToken, setHasToken] = useState(false);

    useEffect(()  => {
        const token = localStorage.getItem("token");
        setHasToken(!!token);
    }, []);

    const handleLogin = (token) => {
        localStorage.setItem("token", token);
        setHasToken(true);
    };

    if (!hasToken) {
        return <AuthPage onLoggedIn={handleLogin} />;
    }


    return <GameShell />
}
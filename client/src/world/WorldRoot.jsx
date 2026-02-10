import { useEffect, useState } from "react";
import { AuthPage } from "@/pages/AuthPage";

export function WorldRoot() {
    const [hasToken, setHasToken] = useState(false);

    useEffect(()  => {
        const token = localStorage.getItem("token");
        setHasToken(!!token);
    }, []);

    if(!hasToken) {
        return <AuthPage/>       
    }

    return (
            <div>
                <h1>Usuário no lobby</h1>
            </div>
        )
}
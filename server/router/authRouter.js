import { Router } from "express";
import { register } from "../service/authService.js"

const router = Router();

router.post("/register", register);

export default router;
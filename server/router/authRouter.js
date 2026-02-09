//authRouter.js
const Router = require("express");
const router = Router();

const { register, login } = require("../service/authService")
        
router.post("/register", register);
router.post("/login", login);


module.exports = router;
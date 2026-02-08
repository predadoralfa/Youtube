const Router = require("express");
const router = Router();

const { register } = require("../service/authService")
        
router.post("/register", register);

module.exports = router;
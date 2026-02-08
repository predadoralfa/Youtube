const register = async (req, res) => {
    return res.status(200).json({
        menssage: "Rota recebida pelo server"
    });
}

module.exports = { register };
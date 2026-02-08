const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false,
        timezone: '-03:00',
        define: {
            underscored: true,
            timestamps: true
        }
    }
);


const autenticarBanco = async () => {
    try{
       await sequelize.authenticate();
       console.log('Conxão com o banco estabelicida com sucesso!') 
    } catch (error) {
        console.log("Erro ao conectar ao MYSQL", error)
    }    
};

autenticarBanco();
module.exports = sequelize;
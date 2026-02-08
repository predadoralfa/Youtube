const bcrypt = require("bcrypt");

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        senha: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nome: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'user',
        hooks: {
            beforeCreate: async (user) => {
                if(user.senha) {
                    const salt = await bcrypt.getSalt(10);
                    user.senha = await bcrypt.hash(user.senha, salt);
                }
            }
        }
    })
}
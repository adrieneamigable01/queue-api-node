// models/Employee.model.js

/**
 * Sequelize model definition for the Employee entity.
 * This file is imported by index.js to initialize the model.
 * Matches database fields: id, user_id, name, email, role, is_active, date_joined
 **/
module.exports = (database, Sequelize) => {
    // 📌 The model name is explicitly set to "employees" to match your table name.
    return database.define("employees", {
        user_id: {
            type: Sequelize.STRING, 
            allowNull: false,
            unique: true 
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        email: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        role: {
            type: Sequelize.STRING, 
            allowNull: false
        },
        is_active: {
            type: Sequelize.BOOLEAN,
            defaultValue: true
        },
        date_joined: {
            type: Sequelize.DATEONLY
        }
    });
};
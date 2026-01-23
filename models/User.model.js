module.exports = (database, Sequelize) => {
    // Defines the model and table name as 'users'
    return database.define("users", {
        user_id: {
            type: Sequelize.STRING,
            allowNull: false,
            primaryKey: true, // Set user_id as the primary key
            unique: true
        },
        username: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true // Ensures no two users share the same username
        },
        password: {
            type: Sequelize.STRING,
            allowNull: false
        },
        user_type: {
            type: Sequelize.STRING, // e.g., 'Admin', 'Staff', 'Manager'
            allowNull: false
        },
        role: {
            type: Sequelize.STRING, // e.g., 'Admin', 'Staff', 'Manager'
            allowNull: false
        },
        created_at: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        }
    }, {
        // Disable Sequelize's default 'createdAt' and 'updatedAt' 
        // since your table uses 'created_at' and does not use 'updatedAt'.
        timestamps: false,
        tableName: 'users' // Explicitly set the table name
    });
};
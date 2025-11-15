/**
 * Created by Christos Ploutarchou
 * Project : node_rest_api_with_mysql
 * Filename : Sequelize.js
 * Date: 03/04/2020
 * Time: 23:33
 **/
const dbConfig = require("../config/db.config");
const Sequelize = require("sequelize");
const database = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    // operatorsAliases: false,
    pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle
    }
});

const db = {};
db.Sequelize = Sequelize;
db.databaseConf = database;

// function to drop existing tables and re-sync database
db.dropRestApiTable = () => {
    db.databaseConf.sync({ force: true }).then(() => {
        // You may want to update this log message to include all tables managed by Sequelize
        console.log("Database tables just dropped and db re-synced.");
    });
};

// 📌 1. Import and initialize the existing Post/Tutorial model
// Renamed 'Sequelize.model' to 'Post.model' for clarity, assuming it defines the Post/Tutorial.
db.posts = require("./Post.model")(database, Sequelize); 

// 📌 2. ADD THE NEW EMPLOYEE MODEL HERE
// Assumes you created a file named 'Employee.model.js' in the same directory.
db.employees = require("./Employee.model")(database, Sequelize);

db.users = require("./User.model")(database, Sequelize);

module.exports = db;
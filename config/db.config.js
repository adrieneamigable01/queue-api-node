/**
 * Created by Christos Ploutarchou
 * Project : node_rest_api_with_mysql
 * Filename : db.config.js
 * Date: 03/04/2020
 * Time: 21:32
 **/
module.exports = {
  HOST: "localhost",
  USER: "root",
  PASSWORD: "",
  DB: "db_queue",
  dialect: "mysql",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

module.exports = {
  HOST: process.env.DB_HOST || "148.222.53.10", // MySQL host
  USER: process.env.DB_USER || "u859692781_queque",
  PASSWORD: process.env.DB_PASS || "Thequck!123",
  DB: process.env.DB_NAME || "u859692781_queque",
  dialect: "mysql",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

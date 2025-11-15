/**
 * Created by Christos Ploutarchou
 * Project : node_rest_api_with_mysql
 * Filename : routes.js
 * Date: 05/04/2020
 * Time: 01:45
 **/

const post = require("../controllers/Post");
const employee = require("../controllers/Employee"); // Import the Employee controller
const auth = require("../controllers/Auth");
const express = require("express");
const router = express.Router();

// 🚨 CORRECT MIDDLEWARE IMPORT: Since authJwt.js exports a single function, 
// import it directly as 'verifyToken'. This resolves the "Undefined" error.
const verifyToken = require("../middleware/authJwt"); 

// --- AUTHENTICATION ROUTES ---
router.post("/api/auth/login", auth.login);
router.post("/api/auth/signup", auth.signup);

// --- POST ROUTES ---
router.post("/api/posts/create", post.create);

// --- EMPLOYEE ROUTES (Protected by JWT) ---
// Note: This route is now secured. The request must include a valid JWT.
router.get(
    "/api/employees/all", 
    verifyToken, // 💡 Use 'verifyToken' directly as it is the exported function
    employee.getAllEmployees
);
router.post(
    "/api/employees/create", 
    verifyToken, // 💡 Use 'verifyToken' directly as it is the exported function
    employee.create
);
router.put(
    "/api/employees/update", 
    verifyToken, // 💡 Use 'verifyToken' directly as it is the exported function
    employee.updateEmployee
);

module.exports = router;
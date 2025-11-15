const jwt = require("jsonwebtoken");
// Use the same secret as in Auth.js
const jwtSecret = "DREY"; 

const verifyToken = (req, res, next) => {
    // Get token from the Authorization header (Bearer <token>)
    let token = req.headers["x-access-token"] || req.headers["authorization"]?.split(' ')[1];

    if (!token) {
        return res.status(403).send({ message: "No token provided!" });
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Unauthorized!" });
        }
        // Attach the decoded user info to the request object
        req.userId = decoded.user_id;
        req.userType = decoded.user_type;
        next();
    });
};

module.exports = verifyToken;
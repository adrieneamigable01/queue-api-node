// controllers/Auth.js (Only the signup function is shown)

const db = require("../models");
const User = db.users;
const Employee = db.employees; // 📌 Get the Employee model
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const employeeObj = db.employees; // Assuming your model is named 'employees'
const Op = db.Sequelize.Op;
const { jwtSecret } = require("../constants/Jwtconstants"); // Adjust the path as necessary

// ... jwtSecret and login function are above this ...

// Helper function to generate a unique ID based on timestamp
const generateUniqueId = () => {
    // Format: USER-YYYYMMDDHHmmss_random
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 14); // YYYYMMDDHHmmss
    const uniquePart = Math.random().toString(36).substring(2, 6); // Add a small random string
    return `USER-${timestamp}_${uniquePart}`;
};

exports.login = async (req, res) => {
    // Note: Assuming User, employeeObj (or Employee), bcrypt, jwt, Op, and jwtSecret are imported/defined
    const { username, password } = req.body; 

    console.log(`username : ${username}`);

    try {
        // 1. Find the user by searching the input value against EITHER username OR email
        const user = await User.findOne({ 
            where: { 
                [Op.or]: [
                    { username: username }, 
                ]
            } 
        });

        if (!user) {
            return res.status(201).send({ message: "User not found.",isError:true, });
        }

        console.log(`user_type : ${user.user_type}`);

        // 2. Check the password
        const passwordIsValid = bcrypt.compareSync(
            password,
            user.password 
        );
        
        if (!passwordIsValid) {
            return res.status(201).send({
                accessToken: null,
                message: "Invalid Password!",
                isError:true,
            });
        }

        // 3. Find the corresponding Employee record
        // Assuming your Employee model is imported as employeeObj or Employee
        const employee = await employeeObj.findOne({ 
            where: { user_id: user.user_id } 
        });
        
        // Handle case where user exists but employee record doesn't (shouldn't happen with signup logic)
        if (!employee && user.user_type == "Employee") {
            console.error(`Employee record not found for user ID: ${user.user_id}`);
             return res.status(201).send({ message: "Employee record not found for user ID.",isError:true, });
            // Still allow login but warn the client, or deny access if employee status is critical
            // We'll proceed with null employee data for robustness.
        }

        // Convert employee object to a plain object for cleaner use in JWT and response
        const employeeData = employee ? employee.get({ plain: true }) : null;

        // 4. Generate a token, including user AND employee data (excluding sensitive fields like password/email from JWT)
        const token = jwt.sign({ 
            user: {
                user_id: user.user_id,
                username: user.username,
                user_type: user.user_type,
                role: user.role,
            },
            employee: employeeData ? {
                name: employeeData.name,
                role: employeeData.role,
                is_active: employeeData.is_active,
                // Do NOT include employeeData.email here as it's redundant/sensitive
            } : null
        }, jwtSecret, {
            expiresIn: 86400 // 24 hours
        });

        // 5. Send success response with token AND all data
        res.status(200).send({
           data:{
                user_id: user.user_id,
                username: user.username,
                user_type: user.user_type,
                accessToken: token,
                employee_data: employeeData // Include the full employee data in the response body
            },
            isError:false,
            message:"Success Login"
        });
        
    } catch (error) {
        res.status(201).send({ 
            message: error.message || "An internal server error occurred during login.",
            isError:true,
        });
    }
};


// controllers/Auth.js (Revised try...catch logic)
exports.signup = async (req, res) => {
    // 📌 FIX: Destructure all required variables from req.body, including 'password'.
    const { username, email, password, user_type, name, role, is_active, date_joined } = req.body;

    // Helper function to generate a unique ID based on timestamp (Must be defined outside this function or imported)
    // NOTE: Assuming generateUniqueId and jwtSecret are defined elsewhere in Auth.js
    const application_user_id = generateUniqueId(); 
    
    // Basic validation for critical fields
    if (!username || !password || !user_type || !name || !role) {
        return res.status(400).send({ message: "Missing required fields (username, password, user_type, name, role)." });
    }
    
    // Start a transaction
    const transaction = await db.databaseConf.transaction();

    try {
        // --- 1. DB Operations inside TRY block ---
        // FIX: The 'password' variable is now available and defined here.
        const hashedPassword = bcrypt.hashSync(password, 8);
        
        // --- Create the User Record (Authentication) ---
        await User.create({
            user_id: application_user_id, // Uses the auto-generated ID
            username: username,
            email: email, 
            password: hashedPassword,
            user_type: user_type,
        }, { transaction });

        // --- Create the Employee Record (HR/Data) ---
        await Employee.create({
            user_id: application_user_id, // Links the user record to the employee record
            name: name,
            email: email,
            role: role,
            is_active: is_active || true, 
            date_joined: date_joined || new Date()
        }, { transaction });

        // 2. Commit the transaction ONLY after successful DB operations
        await transaction.commit();

        // 3. Generate token and send response AFTER commit
        // FIX: application_user_id and user_type are now available.
        const token = jwt.sign({ user_id: application_user_id, user_type: user_type }, jwtSecret, {
            expiresIn: 86400
        });

        return res.status(201).send({
            message: "User and Employee created successfully!",
            user_id: application_user_id, 
            accessToken: token
        });

    } catch (error) {
        // 4. Rollback only if the transaction hasn't been committed/rolled back yet
        if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
            await transaction.rollback();
        }
        
        // 5. Send the error response
        if (error.name === 'SequelizeUniqueConstraintError') {
             return res.status(400).send({ message: "Username or Email already in use." });
        }
        return res.status(201).send({ 
            message: error.message || "Error during user registration and employee creation." 
        });
    }
};
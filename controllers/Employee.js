const db = require("../models");
const User = db.users;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const employeeObj = db.employees;
const Op = db.Sequelize.Op;
const { jwtSecret } = require("../constants/Jwtconstants");

// Helper function to generate a unique ID based on timestamp
const generateUniqueId = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 14);
    const uniquePart = Math.random().toString(36).substring(2, 6);
    return `USER-${timestamp}_${uniquePart}`;
};

// =============================
// CREATE EMPLOYEE
// =============================
exports.create = async (req, res) => {
    const { username, email, password, user_type, name, role, is_active, date_joined } = req.body;
    const application_user_id = generateUniqueId();

    if (!username || !password || !user_type || !name || !role) {
        return res.status(400).send({ message: "Missing required fields (username, password, user_type, name, role).",isError:true });
    }

    const transaction = await db.databaseConf.transaction();
    const io = req.app.get("io"); // ✅ Access Socket.IO

    try {
        const hashedPassword = bcrypt.hashSync(password, 8);

        const newUser = await User.create({
            user_id: application_user_id,
            username,
            email,
            password: hashedPassword,
            user_type
        }, { transaction });

        const newEmployee = await employeeObj.create({
            user_id: application_user_id,
            name,
            email,
            role,
            is_active: is_active ?? true,
            date_joined: date_joined || new Date()
        }, { transaction });

        await transaction.commit();

        const token = jwt.sign({
            user: {
                user_id: newUser.user_id,
                username: newUser.username,
                email: newUser.email,
                user_type: newUser.user_type
            },
            employee: newEmployee.get({ plain: true })
        }, jwtSecret, { expiresIn: 86400 });

        const responseData = {
            message: "Employee created successfully!",
            accessToken: token,
            user_data: {
                user_id: newUser.user_id,
                username: newUser.username,
                email: newUser.email,
                user_type: newUser.user_type
            },
            employee_data: newEmployee.get({ plain: true })
        };

        // ✅ Emit real-time event
        io.emit("employee:created", responseData.employee_data);

        return res.status(201).send({
          data:responseData,
          message:"Success",
          isError:false,
        });

    } catch (error) {
        if (transaction.finished !== "commit" && transaction.finished !== "rollback") {
            await transaction.rollback();
        }

        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(400).send({ message: "Username or Email already in use.",isError:true, });
        }
        return res.status(500).send({ 
          message: error.message || "Error during user registration and employee creation.",
          isError:true,
         });
    }
};

// =============================
// UPDATE EMPLOYEE
// =============================
exports.updateEmployee = async (req, res) => {
    const { user_id, username, email, password, user_type, name, role, is_active } = req.body;

    if (!user_id) {
        return res.status(400).send({ message: "Missing user_id required for update.", isError:true, });
    }

    const transaction = await db.databaseConf.transaction();
    const io = req.app.get("io"); // ✅ Access Socket.IO

    try {
        const userUpdateData = {};
        if (username) userUpdateData.username = username;
        if (email) userUpdateData.email = email;
        if (user_type) userUpdateData.user_type = user_type;
        if (password) userUpdateData.password = bcrypt.hashSync(password, 8);

        const employeeUpdateData = {};
        if (name) employeeUpdateData.name = name;
        if (email) employeeUpdateData.email = email;
        if (role) employeeUpdateData.role = role;
        if (is_active !== undefined) employeeUpdateData.is_active = is_active;

        const [userUpdateCount] = await User.update(userUpdateData, {
            where: { user_id },
            transaction
        });

        const [employeeUpdateCount] = await employeeObj.update(employeeUpdateData, {
            where: { user_id },
            transaction
        });

        if (userUpdateCount === 0 && employeeUpdateCount === 0) {
            await transaction.rollback();
            return res.status(404).send({ message: `User with id ${user_id} not found.`, isError:true, });
        }

        await transaction.commit();

        const updatedUser = await User.findOne({ where: { user_id } });
        const updatedEmployee = await employeeObj.findOne({ where: { user_id } });

        const token = jwt.sign({
            user: {
                user_id: updatedUser.user_id,
                username: updatedUser.username,
                email: updatedUser.email,
                user_type: updatedUser.user_type
            },
            employee: updatedEmployee.get({ plain: true })
        }, jwtSecret, { expiresIn: 86400 });

        const responseData = {
            message: "Employee updated successfully!",
            accessToken: token,
            user_data: {
                user_id: updatedUser.user_id,
                username: updatedUser.username,
                email: updatedUser.email,
                user_type: updatedUser.user_type
            },
            employee_data: updatedEmployee.get({ plain: true })
        };

        // ✅ Emit real-time event
        io.emit("employee:updated", responseData.employee_data);

        return res.status(200).send({data:responseData,message:"Success", isError:false,});

    } catch (error) {
        if (transaction.finished !== "commit" && transaction.finished !== "rollback") {
            await transaction.rollback();
        }

        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(400).send({ message: "Username or Email already in use by another user.", isError:true, });
        }
        return res.status(500).send({ message: error.message || "Error during employee update.", isError:true, });
    }
};

// =============================
// GET ALL EMPLOYEES
// =============================
exports.getAllEmployees = (req, res) => {
    db.databaseConf.query(`SELECT employees.id,employees.user_id,employees.name,employees.email,employees.role,employees.is_active,employees.date_joined,employees.createdAt,employees.updatedAt,users.username,users.user_type
                            FROM employees
                            LEFT JOIN users ON users.user_id = employees.user_id`, {
        type: db.Sequelize.QueryTypes.SELECT
    })
    .then(data => {
        res.status(200).send({
          data:data,
          isError:false,
          message:'Success fetch employees'
        });

        // ✅ Optionally, you can broadcast this data to all connected sockets:
        const io = req.app.get("io");
        io.emit("employee:list", data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "Error retrieving employee data using raw SQL.",
            isError:true,
        });
    });
};

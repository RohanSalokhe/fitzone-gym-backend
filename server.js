// =====================================================
// FITZONE GYM MANAGEMENT SYSTEM
// Render + Aiven MySQL Ready
// =====================================================

require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// =====================================================
// DATABASE CONNECTION
// =====================================================

const db = mysql.createPool({
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQLDATABASE || "gym_management",
    port: Number(process.env.MYSQLPORT) || 3306,

    ...(process.env.MYSQLHOST && {
        ssl: {
            rejectUnauthorized: false,
        },
    }),

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
}).promise();

// =====================================================
// DATABASE TEST
// =====================================================

db.getConnection()
    .then((connection) => {
        console.log("Database connected successfully...");
        connection.release();
    })
    .catch((err) => {
        console.log("Database connection failed:");
        console.log(err.message);
    });

// =====================================================
// ADMIN REGISTER
// =====================================================
// This is ONLY for creating Admin account.
// Member registration uses /register below.
// =====================================================

app.post("/admin/register", async (req, res) => {

    try {

        const {
            name,
            adminName,
            email,
            password,
            address,
            phone
        } = req.body;

        const finalName = name || adminName;

        if (
            !finalName ||
            !email ||
            !password ||
            !address ||
            !phone
        ) {
            return res.status(400).json({
                message: "All admin fields are required"
            });
        }

        const [existingAdmin] = await db.query(
            "SELECT * FROM admins WHERE email = ?",
            [email]
        );

        if (existingAdmin.length > 0) {
            return res.status(400).json({
                message: "Email already exists"
            });
        }

        const [existingUser] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                message: "Email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        const sql = `
            INSERT INTO admins
            (
                adminName,
                email,
                password,
                address,
                phone
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(
            sql,
            [
                finalName,
                email,
                hashedPassword,
                address,
                phone
            ]
        );

        res.status(201).json({

            message: "Admin registration successful",

            adminId: result.insertId,

            adminName: finalName,

            email: email,

            role: "admin"

        });

    } catch (err) {

        console.log(
            "Admin Register Error:",
            err.message
        );

        res.status(500).json({
            error: err.message
        });
    }
});

// =====================================================
// MEMBER REGISTER
// =====================================================
// Member registration will automatically create:
// 1. members table record
// 2. users table login record
//
// Member CANNOT create plan separately.
// Member CANNOT call /members to create another member.
// =====================================================

app.post("/register", async (req, res) => {

    let connection;

    try {

        const {
            memberId,
            memberName,
            name,
            email,
            phone,
            age,
            gender,
            plan,
            password,
            confirmPassword
        } = req.body;

        const finalName = memberName || name;

        // =================================================
        // REQUIRED FIELDS
        // =================================================

        if (
            !finalName ||
            !email ||
            !phone ||
            !age ||
            !gender ||
            !plan ||
            !password
        ) {

            return res.status(400).json({
                message: "All registration fields are required"
            });

        }

        // =================================================
        // PASSWORD VALIDATION
        // =================================================

        if (
            confirmPassword &&
            password !== confirmPassword
        ) {

            return res.status(400).json({
                message: "Passwords do not match"
            });

        }

        if (password.length < 6) {

            return res.status(400).json({
                message:
                    "Password must be at least 6 characters"
            });

        }

        // =================================================
        // CHECK USER EMAIL
        // =================================================

        const [existingUser] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {

            return res.status(400).json({
                message: "Email already exists"
            });

        }

        // =================================================
        // CHECK ADMIN EMAIL
        // =================================================

        const [existingAdmin] = await db.query(
            "SELECT * FROM admins WHERE email = ?",
            [email]
        );

        if (existingAdmin.length > 0) {

            return res.status(400).json({
                message: "Email already exists"
            });

        }

        // =================================================
        // DATABASE CONNECTION
        // =================================================

        connection = await db.getConnection();

        await connection.beginTransaction();

        // =================================================
        // CREATE MEMBER
        // =================================================

        const memberSql = `
            INSERT INTO members
            (
                memberName,
                phone,
                age,
                gender,
                plan
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        const [memberResult] = await connection.query(
            memberSql,
            [
                finalName,
                phone,
                Number(age),
                gender,
                plan
            ]
        );

        const newMemberId =
            memberResult.insertId;

        // =================================================
        // HASH PASSWORD
        // =================================================

        const hashedPassword =
            await bcrypt.hash(password, 10);

        // =================================================
        // CREATE USER LOGIN
        // =================================================

        const userSql = `
            INSERT INTO users
            (
                memberId,
                email,
                password,
                role
            )
            VALUES (?, ?, ?, ?)
        `;

        const [userResult] =
            await connection.query(
                userSql,
                [
                    newMemberId,
                    email,
                    hashedPassword,
                    "member"
                ]
            );

        // =================================================
        // COMMIT
        // =================================================

        await connection.commit();

        // =================================================
        // SUCCESS
        // =================================================

        res.status(201).json({

            message:
                "Member registration successful",

            userId:
                userResult.insertId,

            memberId:
                newMemberId,

            memberName:
                finalName,

            email:
                email,

            role:
                "member"

        });

    } catch (err) {

        if (connection) {

            try {
                await connection.rollback();
            } catch (rollbackError) {

                console.log(
                    "Rollback Error:",
                    rollbackError.message
                );

            }
        }

        console.log(
            "Member Registration Error:",
            err.message
        );

        res.status(500).json({
            error: err.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }
});

// =====================================================
// LOGIN
// =====================================================
// Admin -> Dashboard
// Member -> Member Dashboard
// =====================================================

app.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                message:
                    "Email and password are required"
            });

        }

        // =================================================
        // CHECK ADMIN
        // =================================================

        const [admins] = await db.query(
            "SELECT * FROM admins WHERE email = ?",
            [email]
        );

        if (admins.length > 0) {

            const admin = admins[0];

            const isMatch =
                await bcrypt.compare(
                    password,
                    admin.password
                );

            if (!isMatch) {

                return res.status(401).json({
                    message:
                        "Invalid Email or Password"
                });

            }

            return res.json({

                message:
                    "Login Successful",

                userType:
                    "admin",

                role:
                    "admin",

                adminId:
                    admin.adminId,

                adminName:
                    admin.adminName,

                email:
                    admin.email

            });
        }

        // =================================================
        // CHECK MEMBER
        // =================================================

        const [users] = await db.query(
            `
            SELECT
                u.userId,
                u.memberId,
                u.email,
                u.password,
                u.role,

                m.memberName,
                m.phone,
                m.age,
                m.gender,
                m.plan

            FROM users u

            LEFT JOIN members m
                ON u.memberId = m.memberId

            WHERE u.email = ?
            `,
            [email]
        );

        if (users.length === 0) {

            return res.status(401).json({
                message:
                    "Invalid Email or Password"
            });

        }

        const user = users[0];

        const isMatch =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!isMatch) {

            return res.status(401).json({
                message:
                    "Invalid Email or Password"
            });

        }

        // =================================================
        // MEMBER LOGIN SUCCESS
        // =================================================

        return res.json({

            message:
                "Login Successful",

            userType:
                "member",

            role:
                "member",

            userId:
                user.userId,

            memberId:
                user.memberId,

            memberName:
                user.memberName,

            email:
                user.email,

            phone:
                user.phone,

            age:
                user.age,

            gender:
                user.gender,

            plan:
                user.plan

        });

    } catch (err) {

        console.log(
            "Login Error:",
            err.message
        );

        res.status(500).json({
            error: err.message
        });

    }
});

// =====================================================
// GET CURRENT USER / MEMBER
// =====================================================

app.get("/users/:userId", async (req, res) => {

    try {

        const {
            userId
        } = req.params;

        const [users] = await db.query(
            `
            SELECT
                u.userId,
                u.memberId,
                u.email,
                u.role,

                m.memberName,
                m.phone,
                m.age,
                m.gender,
                m.plan

            FROM users u

            LEFT JOIN members m
                ON u.memberId = m.memberId

            WHERE u.userId = ?
            `,
            [userId]
        );

        if (users.length === 0) {

            return res.status(404).json({
                message:
                    "User not found"
            });

        }

        res.json(users[0]);

    } catch (err) {

        console.log(
            "Get User Error:",
            err.message
        );

        res.status(500).json({
            error: err.message
        });

    }
});

// =====================================================
// ADMIN CHECK MIDDLEWARE
// =====================================================
// Frontend must send:
// Authorization: admin
// =====================================================

const adminOnly = (req, res, next) => {

    const role =
        req.headers.authorization;

    if (role !== "admin") {

        return res.status(403).json({

            message:
                "Access denied. Only admin can perform this action."

        });

    }

    next();
};

// =====================================================
// ADD MEMBER
// =====================================================
// ONLY ADMIN
// Member registration does NOT use this API.
// =====================================================

app.post(
    "/members",
    adminOnly,
    async (req, res) => {

        try {

            const {
                memberName,
                phone,
                age,
                gender,
                plan
            } = req.body;

            if (
                !memberName ||
                !phone ||
                !age ||
                !gender ||
                !plan
            ) {

                return res.status(400).json({
                    message:
                        "All member fields are required"
                });

            }

            const sql = `
                INSERT INTO members
                (
                    memberName,
                    phone,
                    age,
                    gender,
                    plan
                )
                VALUES (?, ?, ?, ?, ?)
            `;

            const [result] =
                await db.query(
                    sql,
                    [
                        memberName,
                        phone,
                        age,
                        gender,
                        plan
                    ]
                );

            res.status(201).json({

                message:
                    "Member added successfully",

                memberId:
                    result.insertId

            });

        } catch (err) {

            console.log(
                "Add Member Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// GET ALL MEMBERS
// =====================================================
// Admin dashboard use
// =====================================================

app.get(
    "/members",
    adminOnly,
    async (req, res) => {

        try {

            const [members] =
                await db.query(
                    `
                    SELECT *
                    FROM members
                    ORDER BY memberId DESC
                    `
                );

            res.json(members);

        } catch (err) {

            console.log(
                "Get Members Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// GET MEMBER BY ID
// =====================================================

app.get(
    "/members/:memberId",
    adminOnly,
    async (req, res) => {

        try {

            const {
                memberId
            } = req.params;

            const [members] =
                await db.query(
                    `
                    SELECT *
                    FROM members
                    WHERE memberId = ?
                    `,
                    [memberId]
                );

            if (members.length === 0) {

                return res.status(404).json({
                    message:
                        "Member not found"
                });

            }

            res.json(members[0]);

        } catch (err) {

            console.log(
                "Get Member Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// UPDATE MEMBER
// =====================================================

app.put(
    "/members/:memberId",
    adminOnly,
    async (req, res) => {

        try {

            const {
                memberId
            } = req.params;

            const {
                memberName,
                phone,
                age,
                gender,
                plan
            } = req.body;

            const sql = `
                UPDATE members
                SET
                    memberName = ?,
                    phone = ?,
                    age = ?,
                    gender = ?,
                    plan = ?
                WHERE memberId = ?
            `;

            const [result] =
                await db.query(
                    sql,
                    [
                        memberName,
                        phone,
                        age,
                        gender,
                        plan,
                        memberId
                    ]
                );

            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({
                    message:
                        "Member not found"
                });

            }

            res.json({
                message:
                    "Member updated successfully"
            });

        } catch (err) {

            console.log(
                "Update Member Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// DELETE MEMBER
// =====================================================

app.delete(
    "/members/:memberId",
    adminOnly,
    async (req, res) => {

        try {

            const {
                memberId
            } = req.params;

            const [result] =
                await db.query(
                    `
                    DELETE FROM members
                    WHERE memberId = ?
                    `,
                    [memberId]
                );

            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({
                    message:
                        "Member not found"
                });

            }

            res.json({
                message:
                    "Member deleted successfully"
            });

        } catch (err) {

            console.log(
                "Delete Member Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// ADD PLAN
// =====================================================
// ONLY ADMIN
// =====================================================

app.post(
    "/plans",
    adminOnly,
    async (req, res) => {

        try {

            const {
                planId,
                planName,
                duration,
                fee,
                description
            } = req.body;

            if (
                !planId ||
                !planName ||
                !duration ||
                fee === undefined
            ) {

                return res.status(400).json({
                    message:
                        "Plan ID, Plan Name, Duration and Fee are required"
                });

            }

            const [existingPlan] =
                await db.query(
                    `
                    SELECT *
                    FROM plans
                    WHERE planId = ?
                    `,
                    [planId]
                );

            if (
                existingPlan.length > 0
            ) {

                return res.status(400).json({
                    message:
                        "Plan ID already exists"
                });

            }

            const sql = `
                INSERT INTO plans
                (
                    planId,
                    planName,
                    duration,
                    fee,
                    description
                )
                VALUES (?, ?, ?, ?, ?)
            `;

            await db.query(
                sql,
                [
                    planId,
                    planName,
                    duration,
                    fee,
                    description || null
                ]
            );

            res.json({
                message:
                    "Plan added successfully"
            });

        } catch (err) {

            console.log(
                "Add Plan Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// GET ALL PLANS
// =====================================================
// Both Admin and Member can VIEW plans.
// Only Admin can ADD / UPDATE / DELETE.
// =====================================================

app.get("/plans", async (req, res) => {

    try {

        const [plans] =
            await db.query(
                "SELECT * FROM plans"
            );

        res.json(plans);

    } catch (err) {

        console.log(
            "Get Plans Error:",
            err.message
        );

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// GET PLAN BY ID
// =====================================================

app.get(
    "/plans/:planId",
    async (req, res) => {

        try {

            const {
                planId
            } = req.params;

            const [plans] =
                await db.query(
                    `
                    SELECT *
                    FROM plans
                    WHERE planId = ?
                    `,
                    [planId]
                );

            if (plans.length === 0) {

                return res.status(404).json({
                    message:
                        "Plan not found"
                });

            }

            res.json(plans[0]);

        } catch (err) {

            console.log(
                "Get Plan Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// UPDATE PLAN
// =====================================================

app.put(
    "/plans/:planId",
    adminOnly,
    async (req, res) => {

        try {

            const {
                planId
            } = req.params;

            const {
                planName,
                duration,
                fee,
                description
            } = req.body;

            const sql = `
                UPDATE plans
                SET
                    planName = ?,
                    duration = ?,
                    fee = ?,
                    description = ?
                WHERE planId = ?
            `;

            const [result] =
                await db.query(
                    sql,
                    [
                        planName,
                        duration,
                        fee,
                        description || null,
                        planId
                    ]
                );

            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({
                    message:
                        "Plan not found"
                });

            }

            res.json({
                message:
                    "Plan updated successfully"
            });

        } catch (err) {

            console.log(
                "Update Plan Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// DELETE PLAN
// =====================================================

app.delete(
    "/plans/:planId",
    adminOnly,
    async (req, res) => {

        try {

            const {
                planId
            } = req.params;

            const [result] =
                await db.query(
                    `
                    DELETE FROM plans
                    WHERE planId = ?
                    `,
                    [planId]
                );

            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({
                    message:
                        "Plan not found"
                });

            }

            res.json({
                message:
                    "Plan deleted successfully"
            });

        } catch (err) {

            console.log(
                "Delete Plan Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// ADD PAYMENT
// =====================================================

app.post(
    "/payments",
    adminOnly,
    async (req, res) => {

        try {

            const {
                memberId,
                amount,
                paymentDate,
                paymentMethod,
                paymentStatus
            } = req.body;

            if (
                !memberId ||
                amount === undefined
            ) {

                return res.status(400).json({
                    message:
                        "Member ID and Amount are required"
                });

            }

            const [member] =
                await db.query(
                    `
                    SELECT *
                    FROM members
                    WHERE memberId = ?
                    `,
                    [memberId]
                );

            if (member.length === 0) {

                return res.status(404).json({
                    message:
                        "Member not found"
                });

            }

            const sql = `
                INSERT INTO payments
                (
                    memberId,
                    amount,
                    paymentDate,
                    paymentMethod,
                    paymentStatus
                )
                VALUES (?, ?, ?, ?, ?)
            `;

            await db.query(
                sql,
                [
                    memberId,
                    amount,
                    paymentDate || null,
                    paymentMethod || null,
                    paymentStatus || "Pending"
                ]
            );

            res.json({
                message:
                    "Payment added successfully"
            });

        } catch (err) {

            console.log(
                "Add Payment Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// GET ALL PAYMENTS
// =====================================================

app.get(
    "/payments",
    adminOnly,
    async (req, res) => {

        try {

            const sql = `
                SELECT
                    p.memberId,
                    m.memberName,
                    p.amount,
                    p.paymentDate,
                    p.paymentMethod,
                    p.paymentStatus

                FROM payments p

                LEFT JOIN members m
                    ON p.memberId = m.memberId

                ORDER BY p.paymentDate DESC
            `;

            const [payments] =
                await db.query(sql);

            res.json(payments);

        } catch (err) {

            console.log(
                "Get Payments Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// GET PAYMENTS BY MEMBER ID
// =====================================================

app.get(
    "/payments/:memberId",
    async (req, res) => {

        try {

            const {
                memberId
            } = req.params;

            const sql = `
                SELECT
                    p.memberId,
                    m.memberName,
                    p.amount,
                    p.paymentDate,
                    p.paymentMethod,
                    p.paymentStatus

                FROM payments p

                LEFT JOIN members m
                    ON p.memberId = m.memberId

                WHERE p.memberId = ?

                ORDER BY p.paymentDate DESC
            `;

            const [payments] =
                await db.query(
                    sql,
                    [memberId]
                );

            res.json(payments);

        } catch (err) {

            console.log(
                "Get Member Payments Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// COUNT MEMBERS
// =====================================================

app.get(
    "/countofmembers",
    adminOnly,
    async (req, res) => {

        try {

            const [result] =
                await db.query(
                    "SELECT COUNT(*) AS TOTAL FROM members"
                );

            res.json(result[0]);

        } catch (err) {

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// COUNT PLANS
// =====================================================

app.get(
    "/countofplans",
    adminOnly,
    async (req, res) => {

        try {

            const [result] =
                await db.query(
                    "SELECT COUNT(*) AS TOTAL FROM plans"
                );

            res.json(result[0]);

        } catch (err) {

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// COUNT PAYMENTS
// =====================================================

app.get(
    "/countofpayments",
    adminOnly,
    async (req, res) => {

        try {

            const [result] =
                await db.query(
                    "SELECT COUNT(*) AS TOTAL FROM payments"
                );

            res.json(result[0]);

        } catch (err) {

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// TOTAL PAYMENT
// =====================================================

app.get(
    "/totalpayment",
    adminOnly,
    async (req, res) => {

        try {

            const [result] =
                await db.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(amount),
                            0
                        ) AS TOTAL
                    FROM payments
                    `
                );

            res.json(result[0]);

        } catch (err) {

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// CONFIRMED PAYMENTS
// =====================================================

app.get(
    "/countofconfirmedpayments",
    adminOnly,
    async (req, res) => {

        try {

            const [result] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS TOTAL
                    FROM payments
                    WHERE paymentStatus = 'Confirmed'
                    `
                );

            res.json(result[0]);

        } catch (err) {

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// PENDING PAYMENTS
// =====================================================

app.get(
    "/countofpendingpayments",
    adminOnly,
    async (req, res) => {

        try {

            const [result] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS TOTAL
                    FROM payments
                    WHERE paymentStatus = 'Pending'
                    `
                );

            res.json(result[0]);

        } catch (err) {

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// CANCELLED / FAILED PAYMENTS
// =====================================================

app.get(
    "/countofcancelledpayments",
    adminOnly,
    async (req, res) => {

        try {

            const [result] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS TOTAL
                    FROM payments
                    WHERE paymentStatus
                    IN ('Cancelled', 'Failed')
                    `
                );

            res.json(result[0]);

        } catch (err) {

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// DASHBOARD
// =====================================================
// ONLY ADMIN
// =====================================================

app.get(
    "/dashboard",
    adminOnly,
    async (req, res) => {

        try {

            const [members] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS totalMembers
                    FROM members
                    `
                );

            const [plans] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS totalPlans
                    FROM plans
                    `
                );

            const [payments] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS totalPayments
                    FROM payments
                    `
                );

            const [amount] =
                await db.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(amount),
                            0
                        ) AS totalAmount
                    FROM payments
                    `
                );

            res.json({

                totalMembers:
                    members[0].totalMembers,

                totalPlans:
                    plans[0].totalPlans,

                totalPayments:
                    payments[0].totalPayments,

                totalAmount:
                    amount[0].totalAmount

            });

        } catch (err) {

            console.log(
                "Dashboard Error:",
                err.message
            );

            res.status(500).json({
                error: err.message
            });

        }

    }
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {

    res.json({

        message:
            "FitZone Gym Management API is running successfully",

        status:
            "OK"

    });

});

// =====================================================
// SERVER START
// =====================================================

const PORT =
    process.env.PORT || 5005;

app.listen(PORT, () => {

    console.log(
        `Gym Management API is running on port ${PORT}...`
    );

});
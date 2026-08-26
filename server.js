// =====================================================
// FITZONE GYM MANAGEMENT SYSTEM - BACKEND
// Railway Ready Backend
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
app.use(cors());

// =====================================================
// DATABASE CONNECTION
// =====================================================

const db = mysql.createPool({
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQLDATABASE || "gym_management",
    port: Number(process.env.MYSQLPORT) || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// Test database connection
db.getConnection()
    .then(connection => {
        console.log("Database connected successfully...");
        connection.release();
    })
    .catch(err => {
        console.log("Database connection failed:");
        console.log(err.message);
    });

// =====================================================
// ADMIN REGISTER
// =====================================================

app.post("/register", async (req, res) => {

    try {

        const {
            adminName,
            email,
            password
        } = req.body;

        if (!adminName || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const [existingAdmin] = await db.query(
            "SELECT * FROM admins WHERE email = ?",
            [email]
        );

        if (existingAdmin.length > 0) {
            return res.status(400).json({
                message: "Admin already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO admins
            (adminName, email, password)
            VALUES (?, ?, ?)`,
            [
                adminName,
                email,
                hashedPassword
            ]
        );

        res.json({
            message: "Registration successful"
        });

    } catch (err) {

        console.log("Admin Register Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// ADMIN LOGIN
// =====================================================

app.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const [admins] = await db.query(
            "SELECT * FROM admins WHERE email = ?",
            [email]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                message: "Invalid Email or Password"
            });
        }

        const admin = admins[0];

        const isMatch = await bcrypt.compare(
            password,
            admin.password
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid Email or Password"
            });
        }

        res.json({
            message: "Login Successful",
            adminId: admin.adminId,
            adminName: admin.adminName,
            email: admin.email
        });

    } catch (err) {

        console.log("Admin Login Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// ADD MEMBER
// =====================================================

app.post("/members", async (req, res) => {

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
                message: "All member fields are required"
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

        const [result] = await db.query(sql, [
            memberName,
            phone,
            age,
            gender,
            plan
        ]);

        res.status(201).json({

            message: "Member added successfully",

            memberId: result.insertId

        });

    } catch (err) {

        console.log("Add Member Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// GET ALL MEMBERS
// =====================================================

app.get("/members", async (req, res) => {

    try {

        const [members] = await db.query(
            "SELECT * FROM members ORDER BY memberId DESC"
        );

        res.json(members);

    } catch (err) {

        console.log("Get Members Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// GET MEMBER BY ID
// =====================================================

app.get("/members/:memberId", async (req, res) => {

    try {

        const {
            memberId
        } = req.params;

        const [members] = await db.query(
            "SELECT * FROM members WHERE memberId = ?",
            [memberId]
        );

        if (members.length === 0) {

            return res.status(404).json({
                message: "Member not found"
            });

        }

        res.json(members[0]);

    } catch (err) {

        console.log("Get Member Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// UPDATE MEMBER
// =====================================================

app.put("/members/:memberId", async (req, res) => {

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

        const [result] = await db.query(sql, [
            memberName,
            phone,
            age,
            gender,
            plan,
            memberId
        ]);

        if (result.affectedRows === 0) {

            return res.status(404).json({
                message: "Member not found"
            });

        }

        res.json({
            message: "Member updated successfully"
        });

    } catch (err) {

        console.log("Update Member Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// DELETE MEMBER
// =====================================================

app.delete("/members/:memberId", async (req, res) => {

    try {

        const {
            memberId
        } = req.params;

        const [result] = await db.query(
            "DELETE FROM members WHERE memberId = ?",
            [memberId]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                message: "Member not found"
            });

        }

        res.json({
            message: "Member deleted successfully"
        });

    } catch (err) {

        console.log("Delete Member Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// ADD PLAN
// =====================================================

app.post("/plans", async (req, res) => {

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

        const [existingPlan] = await db.query(
            "SELECT * FROM plans WHERE planId = ?",
            [planId]
        );

        if (existingPlan.length > 0) {

            return res.status(400).json({
                message: "Plan ID already exists"
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

        await db.query(sql, [
            planId,
            planName,
            duration,
            fee,
            description
        ]);

        res.json({
            message: "Plan added successfully"
        });

    } catch (err) {

        console.log("Add Plan Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// GET ALL PLANS
// =====================================================

app.get("/plans", async (req, res) => {

    try {

        const [plans] = await db.query(
            "SELECT * FROM plans"
        );

        res.json(plans);

    } catch (err) {

        console.log("Get Plans Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// GET PLAN BY ID
// =====================================================

app.get("/plans/:planId", async (req, res) => {

    try {

        const {
            planId
        } = req.params;

        const [plans] = await db.query(
            "SELECT * FROM plans WHERE planId = ?",
            [planId]
        );

        if (plans.length === 0) {

            return res.status(404).json({
                message: "Plan not found"
            });

        }

        res.json(plans[0]);

    } catch (err) {

        console.log("Get Plan Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// UPDATE PLAN
// =====================================================

app.put("/plans/:planId", async (req, res) => {

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

        const [result] = await db.query(sql, [
            planName,
            duration,
            fee,
            description,
            planId
        ]);

        if (result.affectedRows === 0) {

            return res.status(404).json({
                message: "Plan not found"
            });

        }

        res.json({
            message: "Plan updated successfully"
        });

    } catch (err) {

        console.log("Update Plan Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// DELETE PLAN
// =====================================================

app.delete("/plans/:planId", async (req, res) => {

    try {

        const {
            planId
        } = req.params;

        const [result] = await db.query(
            "DELETE FROM plans WHERE planId = ?",
            [planId]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                message: "Plan not found"
            });

        }

        res.json({
            message: "Plan deleted successfully"
        });

    } catch (err) {

        console.log("Delete Plan Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// ADD PAYMENT
// =====================================================

app.post("/payments", async (req, res) => {

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
                message: "Member ID and Amount are required"
            });

        }

        const [member] = await db.query(
            "SELECT * FROM members WHERE memberId = ?",
            [memberId]
        );

        if (member.length === 0) {

            return res.status(404).json({
                message: "Member not found"
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

        await db.query(sql, [
            memberId,
            amount,
            paymentDate || null,
            paymentMethod || null,
            paymentStatus || "Pending"
        ]);

        res.json({
            message: "Payment added successfully"
        });

    } catch (err) {

        console.log("Add Payment Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// GET ALL PAYMENTS
// =====================================================

app.get("/payments", async (req, res) => {

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

        const [payments] = await db.query(sql);

        res.json(payments);

    } catch (err) {

        console.log("Get Payments Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// GET PAYMENTS BY MEMBER ID
// =====================================================

app.get("/payments/:memberId", async (req, res) => {

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

        const [payments] = await db.query(
            sql,
            [memberId]
        );

        res.json(payments);

    } catch (err) {

        console.log("Get Member Payments Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// COUNT OF MEMBERS
// =====================================================

app.get("/countofmembers", async (req, res) => {

    try {

        const [result] = await db.query(
            "SELECT COUNT(*) AS TOTAL FROM members"
        );

        res.json(result[0]);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// COUNT OF PLANS
// =====================================================

app.get("/countofplans", async (req, res) => {

    try {

        const [result] = await db.query(
            "SELECT COUNT(*) AS TOTAL FROM plans"
        );

        res.json(result[0]);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// COUNT OF PAYMENTS
// =====================================================

app.get("/countofpayments", async (req, res) => {

    try {

        const [result] = await db.query(
            "SELECT COUNT(*) AS TOTAL FROM payments"
        );

        res.json(result[0]);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// TOTAL PAYMENT AMOUNT
// =====================================================

app.get("/totalpayment", async (req, res) => {

    try {

        const [result] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) AS TOTAL
             FROM payments`
        );

        res.json(result[0]);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// CONFIRMED PAYMENTS
// =====================================================

app.get("/countofconfirmedpayments", async (req, res) => {

    try {

        const [result] = await db.query(
            `SELECT COUNT(*) AS TOTAL
             FROM payments
             WHERE paymentStatus = 'Confirmed'`
        );

        res.json(result[0]);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// PENDING PAYMENTS
// =====================================================

app.get("/countofpendingpayments", async (req, res) => {

    try {

        const [result] = await db.query(
            `SELECT COUNT(*) AS TOTAL
             FROM payments
             WHERE paymentStatus = 'Pending'`
        );

        res.json(result[0]);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// FAILED / CANCELLED PAYMENTS
// =====================================================

app.get("/countofcancelledpayments", async (req, res) => {

    try {

        const [result] = await db.query(
            `SELECT COUNT(*) AS TOTAL
             FROM payments
             WHERE paymentStatus IN ('Cancelled', 'Failed')`
        );

        res.json(result[0]);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// DASHBOARD SUMMARY
// =====================================================

app.get("/dashboard", async (req, res) => {

    try {

        const [members] = await db.query(
            "SELECT COUNT(*) AS totalMembers FROM members"
        );

        const [plans] = await db.query(
            "SELECT COUNT(*) AS totalPlans FROM plans"
        );

        const [payments] = await db.query(
            "SELECT COUNT(*) AS totalPayments FROM payments"
        );

        const [amount] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) AS totalAmount
             FROM payments`
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

        console.log("Dashboard Error:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {

    res.json({
        message: "FitZone Gym Management API is running successfully",
        status: "OK"
    });

});

// =====================================================
// SERVER START
// =====================================================

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {

    console.log(
        `Gym Management API is running on port ${PORT}...`
    );

});
const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* ==================================================
   POSTGRESQL
================================================== */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/* ==================================================
   DATABASE SETUP
================================================== */

async function setupDatabase() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS demo_users (
            id SERIAL PRIMARY KEY,
            demo_username TEXT UNIQUE NOT NULL,
            demo_password TEXT,
            demo_balance NUMERIC(12,2) DEFAULT 10000.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        ALTER TABLE demo_users
        ADD COLUMN IF NOT EXISTS demo_password TEXT
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS demo_trades (
            id SERIAL PRIMARY KEY,
            demo_username TEXT NOT NULL,
            asset TEXT NOT NULL,
            direction TEXT NOT NULL,
            stake NUMERIC(12,2) NOT NULL,
            duration TEXT NOT NULL,
            result NUMERIC(12,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("PostgreSQL demo tables ready.");
}

/* ==================================================
   HOME
================================================== */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

/* ==================================================
   DASHBOARD PAGE
================================================== */

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

/* ==================================================
   DATABASE TEST
================================================== */

app.get("/test-db", async (req, res) => {

    try {

        const result = await pool.query("SELECT NOW()");

        res.json({
            success: true,
            databaseTime: result.rows[0].now
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Database connection failed"
        });
    }
});

/* ==================================================
   CREATE / UPDATE DEMO ACCOUNT
================================================== */

app.post("/api/demo-user", async (req, res) => {

    try {

        const username =
            String(req.body.username || "").trim();

        const password =
            String(req.body.password || "");

        if (!username || !password) {

            return res.status(400).json({
                success: false,
                message: "Demo username and password are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO demo_users
            (
                demo_username,
                demo_password
            )
            VALUES ($1, $2)

            ON CONFLICT (demo_username)

            DO UPDATE SET
                demo_password = EXCLUDED.demo_password

            RETURNING
                id,
                demo_username,
                demo_password,
                demo_balance,
                created_at
            `,
            [username, password]
        );

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to create demo account"
        });
    }
});

/* ==================================================
   DEMO LOGIN
================================================== */

app.post("/api/demo-login", async (req, res) => {

    try {

        const username =
            String(req.body.username || "").trim();

        const password =
            String(req.body.password || "");

        if (!username || !password) {

            return res.status(400).json({
                success: false,
                message: "Demo username and password are required"
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                demo_username,
                demo_password,
                demo_balance
            FROM demo_users
            WHERE demo_username = $1
            `,
            [username]
        );

        if (result.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Invalid demo login"
            });
        }

        const user = result.rows[0];

        if (password !== user.demo_password) {

            return res.status(401).json({
                success: false,
                message: "Invalid demo login"
            });
        }

        res.json({
            success: true,
            message: "Demo login successful",
            user: {
                id: user.id,
                username: user.demo_username,
                password: user.demo_password,
                balance: user.demo_balance
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to process demo login"
        });
    }
});

/* ==================================================
   GET DEMO USER
================================================== */

app.get("/api/demo-user/:username", async (req, res) => {

    try {

        const username = req.params.username;

        const result = await pool.query(
            `
            SELECT
                id,
                demo_username,
                demo_password,
                demo_balance,
                created_at
            FROM demo_users
            WHERE demo_username = $1
            `,
            [username]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Demo user not found"
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load demo user"
        });
    }
});

/* ==================================================
   SAVE SIMULATED TRADE
================================================== */

app.post("/api/demo-trade", async (req, res) => {

    try {

        const username =
            String(req.body.username || "").trim();

        const asset =
            String(req.body.asset || "").trim();

        const direction =
            String(req.body.direction || "").trim();

        const duration =
            String(req.body.duration || "").trim();

        const stake =
            Number(req.body.stake);

        const result =
            Number(req.body.result || 0);

        if (
            !username ||
            !asset ||
            !direction ||
            !duration ||
            !Number.isFinite(stake) ||
            stake <= 0 ||
            !Number.isFinite(result)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid simulated trade information"
            });
        }

        const userResult = await pool.query(
            `
            SELECT id
            FROM demo_users
            WHERE demo_username = $1
            `,
            [username]
        );

        if (userResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Demo user not found"
            });
        }

        const trade = await pool.query(
            `
            INSERT INTO demo_trades
            (
                demo_username,
                asset,
                direction,
                stake,
                duration,
                result
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING *
            `,
            [
                username,
                asset,
                direction,
                stake,
                duration,
                result
            ]
        );

        await pool.query(
            `
            UPDATE demo_users
            SET demo_balance = demo_balance + $1
            WHERE demo_username = $2
            `,
            [result, username]
        );

        res.json({
            success: true,
            message: "Simulated trade saved",
            trade: trade.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to save simulated trade"
        });
    }
});

/* ==================================================
   TRADE HISTORY
================================================== */

app.get("/api/demo-trades/:username", async (req, res) => {

    try {

        const username = req.params.username;

        const result = await pool.query(
            `
            SELECT
                id,
                demo_username,
                asset,
                direction,
                stake,
                duration,
                result,
                created_at
            FROM demo_trades
            WHERE demo_username = $1
            ORDER BY created_at DESC
            LIMIT 50
            `,
            [username]
        );

        res.json({
            success: true,
            trades: result.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load trade history"
        });
    }
});

/* ==================================================
   DASHBOARD SUMMARY
================================================== */

app.get("/api/dashboard/:username", async (req, res) => {

    try {

        const username = req.params.username;

        const userResult = await pool.query(
            `
            SELECT
                id,
                demo_username,
                demo_password,
                demo_balance,
                created_at
            FROM demo_users
            WHERE demo_username = $1
            `,
            [username]
        );

        if (userResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Demo user not found"
            });
        }

        const user = userResult.rows[0];

        const stats = await pool.query(
            `
            SELECT
                COUNT(*) AS trade_count,
                COALESCE(SUM(result), 0) AS total_result,
                COALESCE(SUM(stake), 0) AS total_stake
            FROM demo_trades
            WHERE demo_username = $1
            `,
            [username]
        );

        const wins = await pool.query(
            `
            SELECT COUNT(*) AS wins
            FROM demo_trades
            WHERE demo_username = $1
            AND result > 0
            `,
            [username]
        );

        const losses = await pool.query(
            `
            SELECT COUNT(*) AS losses
            FROM demo_trades
            WHERE demo_username = $1
            AND result < 0
            `,
            [username]
        );

        res.json({
            success: true,

            user: {
                id: user.id,
                username: user.demo_username,
                demoPassword: user.demo_password,
                balance: Number(user.demo_balance),
                createdAt: user.created_at
            },

            statistics: {
                tradeCount:
                    Number(stats.rows[0].trade_count),

                totalResult:
                    Number(stats.rows[0].total_result),

                totalStake:
                    Number(stats.rows[0].total_stake),

                wins:
                    Number(wins.rows[0].wins),

                losses:
                    Number(losses.rows[0].losses)
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load dashboard"
        });
    }
});

/* ==================================================
   ALL DEMO USERS
================================================== */

app.get("/demo-data", async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                id,
                demo_username,
                demo_password,
                demo_balance,
                created_at
            FROM demo_users
            ORDER BY id DESC
            `
        );

        res.json({
            success: true,
            users: result.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Unable to load demo users"
        });
    }
});

/* ==================================================
   ALL RECENT DEMO TRADES
================================================== */

app.get("/demo-trades", async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                id,
                demo_username,
                asset,
                direction,
                stake,
                duration,
                result,
                created_at
            FROM demo_trades
            ORDER BY created_at DESC
            LIMIT 100
            `
        );

        res.json({
            success: true,
            trades: result.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Unable to load demo trades"
        });
    }
});

/* ==================================================
   START SERVER
================================================== */

async function startServer() {

    try {

        await setupDatabase();

        app.listen(PORT, () => {

            console.log(
                `TradeDemo running on port ${PORT}`
            );

        });

    } catch (error) {

        console.error(
            "Database startup error:",
            error
        );

        process.exit(1);
    }
}

startServer();

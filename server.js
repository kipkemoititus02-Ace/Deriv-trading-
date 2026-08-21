const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


/* ================================
   DATABASE SETUP
================================ */

async function setupDatabase() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS demo_users (
            id SERIAL PRIMARY KEY,
            demo_username TEXT UNIQUE NOT NULL,
            demo_balance NUMERIC(12,2) DEFAULT 10000.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);


    await pool.query(`
        CREATE TABLE IF NOT EXISTS demo_trades (
            id SERIAL PRIMARY KEY,
            demo_username TEXT NOT NULL,
            asset TEXT NOT NULL,
            direction TEXT NOT NULL,
            stake NUMERIC(12,2) NOT NULL,
            duration TEXT NOT NULL,
            result NUMERIC(12,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

}


/* ================================
   HOME
================================ */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );

});


/* ================================
   DASHBOARD
================================ */

app.get("/dashboard", (req, res) => {

    res.sendFile(
        path.join(__dirname, "dashboard.html")
    );

});


/* ================================
   DATABASE TEST
================================ */

app.get("/test-db", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT NOW()"
        );

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


/* ================================
   CREATE DEMO USER
================================ */

app.post("/api/demo-user", async (req, res) => {

    try {

        const {
            username
        } = req.body;


        if (!username) {

            return res.status(400).json({
                success: false,
                message: "Username is required"
            });

        }


        const result = await pool.query(
            `
            INSERT INTO demo_users
            (demo_username)
            VALUES ($1)
            ON CONFLICT (demo_username)
            DO UPDATE SET demo_username = EXCLUDED.demo_username
            RETURNING *
            `,
            [username]
        );


        res.json({
            success: true,
            user: result.rows[0]
        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to create demo user"
        });

    }

});


/* ================================
   GET DEMO USER
================================ */

app.get("/api/demo-user/:username", async (req, res) => {

    try {

        const username =
            req.params.username;


        const result = await pool.query(
            `
            SELECT *
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


/* ================================
   SAVE SIMULATED TRADE
================================ */

app.post("/api/demo-trade", async (req, res) => {

    try {

        const {
            username,
            asset,
            direction,
            stake,
            duration,
            result
        } = req.body;


        if (
            !username ||
            !asset ||
            !direction ||
            !stake ||
            !duration
        ) {

            return res.status(400).json({
                success: false,
                message: "Missing demo trade information"
            });

        }


        const numericStake =
            Number(stake);

        const numericResult =
            Number(result || 0);


        if (
            !Number.isFinite(numericStake) ||
            numericStake <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid demo stake"
            });

        }


        const trade =
            await pool.query(
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
                    numericStake,
                    duration,
                    numericResult
                ]
            );


        res.json({
            success: true,
            trade: trade.rows[0]
        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to save demo trade"
        });

    }

});


/* ================================
   GET TRADE HISTORY
================================ */

app.get("/api/demo-trades/:username", async (req, res) => {

    try {

        const username =
            req.params.username;


        const result = await pool.query(
            `
            SELECT *
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


/* ================================
   DASHBOARD SUMMARY
================================ */

app.get("/api/dashboard/:username", async (req, res) => {

    try {

        const username =
            req.params.username;


        const userResult =
            await pool.query(
                `
                SELECT *
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


        const tradesResult =
            await pool.query(
                `
                SELECT
                    COUNT(*) AS trade_count,
                    COALESCE(
                        SUM(result),
                        0
                    ) AS total_result
                FROM demo_trades
                WHERE demo_username = $1
                `,
                [username]
            );


        res.json({

            success: true,

            user: userResult.rows[0],

            statistics:
                tradesResult.rows[0]

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load dashboard"
        });

    }

});


/* ================================
   START SERVER
================================ */

async function startServer() {

    try {

        await setupDatabase();

        console.log(
            "PostgreSQL demo tables ready."
        );


        app.listen(
            PORT,
            () => {

                console.log(
                    `TradeDemo running on port ${PORT}`
                );

            }
        );


    } catch (error) {

        console.error(
            "Database startup error:",
            error
        );

        process.exit(1);

    }

}


startServer();

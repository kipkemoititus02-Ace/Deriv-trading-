const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
==================================================
STATIC FILES
==================================================
*/

app.use(express.static(__dirname));

/*
==================================================
POSTGRESQL
==================================================
*/

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/*
==================================================
PASSWORD HELPERS
==================================================
*/

function hashPassword(password) {

    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return {
        salt,
        hash
    };
}


function verifyPassword(password, salt, storedHash) {

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return crypto.timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(storedHash, "hex")
    );
}


/*
==================================================
DATABASE SETUP
==================================================
*/

async function setupDatabase() {

    /*
    DEMO USERS
    */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS demo_users (
            id SERIAL PRIMARY KEY,
            demo_username TEXT UNIQUE NOT NULL,
            demo_password_hash TEXT,
            demo_password_salt TEXT,
            demo_balance NUMERIC(12,2) DEFAULT 10000.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);


    /*
    Makes sure the password columns exist
    even if the table was created previously.
    */

    await pool.query(`
        ALTER TABLE demo_users
        ADD COLUMN IF NOT EXISTS demo_password_hash TEXT
    `);

    await pool.query(`
        ALTER TABLE demo_users
        ADD COLUMN IF NOT EXISTS demo_password_salt TEXT
    `);


    /*
    DEMO TRADES
    */

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


/*
==================================================
HOME
==================================================
*/

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );

});


/*
==================================================
DASHBOARD PAGE
==================================================
*/

app.get("/dashboard", (req, res) => {

    res.sendFile(
        path.join(__dirname, "dashboard.html")
    );

});


/*
==================================================
DATABASE TEST
==================================================
*/

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


/*
==================================================
CREATE / UPDATE DEMO ACCOUNT
==================================================

This creates a fictional demo account.

The password is hashed before being stored.
==================================================
*/

app.post("/api/demo-user", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        if (!username || !password) {

            return res.status(400).json({
                success: false,
                message: "Demo username and password are required"
            });

        }


        if (String(username).length < 3) {

            return res.status(400).json({
                success: false,
                message: "Demo username must contain at least 3 characters"
            });

        }


        if (String(password).length < 4) {

            return res.status(400).json({
                success: false,
                message: "Demo password must contain at least 4 characters"
            });

        }


        const {
            salt,
            hash
        } = hashPassword(String(password));


        const result = await pool.query(
            `
            INSERT INTO demo_users
            (
                demo_username,
                demo_password_hash,
                demo_password_salt
            )
            VALUES ($1,$2,$3)

            ON CONFLICT (demo_username)

            DO UPDATE SET
                demo_password_hash = EXCLUDED.demo_password_hash,
                demo_password_salt = EXCLUDED.demo_password_salt

            RETURNING
                id,
                demo_username,
                demo_balance,
                created_at
            `,
            [
                String(username),
                hash,
                salt
            ]
        );


        res.json({

            success: true,

            message: "Demo account created successfully",

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


/*
==================================================
DEMO LOGIN
==================================================

This is ONLY for fictional demo accounts.
==================================================
*/

app.post("/api/demo-login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        if (!username || !password) {

            return res.status(400).json({

                success: false,

                message: "Demo username and password are required"

            });

        }


        const result = await pool.query(
            `
            SELECT *
            FROM demo_users
            WHERE demo_username = $1
            `,
            [String(username)]
        );


        if (result.rows.length === 0) {

            return res.status(401).json({

                success: false,

                message: "Invalid demo login"

            });

        }


        const user = result.rows[0];


        if (
            !user.demo_password_hash ||
            !user.demo_password_salt
        ) {

            return res.status(401).json({

                success: false,

                message: "Demo account requires password setup"

            });

        }


        let passwordCorrect = false;


        try {

            passwordCorrect = verifyPassword(
                String(password),
                user.demo_password_salt,
                user.demo_password_hash
            );

        } catch (error) {

            passwordCorrect = false;

        }


        if (!passwordCorrect) {

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


/*
==================================================
GET DEMO USER
==================================================
*/

app.get("/api/demo-user/:username", async (req, res) => {

    try {

        const username =
            req.params.username;


        const result = await pool.query(
            `
            SELECT
                id,
                demo_username,
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


/*
==================================================
SAVE SIMULATED TRADE
==================================================
*/

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


        if (
            !Number.isFinite(numericResult)
        ) {

            return res.status(400).json({

                success: false,

                message: "Invalid demo result"

            });

        }


        /*
        Make sure the demo account exists.
        */

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


        /*
        Save simulated trade.
        */

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


        /*
        Update DEMO balance only.
        */

        await pool.query(
            `
            UPDATE demo_users

            SET demo_balance =
                demo_balance + $1

            WHERE demo_username = $2
            `,
            [
                numericResult,
                username
            ]
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


/*
==================================================
GET TRADE HISTORY
==================================================
*/

app.get("/api/demo-trades/:username", async (req, res) => {

    try {

        const username =
            req.params.username;


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


/*
==================================================
DASHBOARD SUMMARY
==================================================
*/

app.get("/api/dashboard/:username", async (req, res) => {

    try {

        const username =
            req.params.username;


        const userResult =
            await pool.query(
                `
                SELECT
                    id,
                    demo_username,
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


        const tradesResult =
            await pool.query(
                `
                SELECT

                    COUNT(*) AS trade_count,

                    COALESCE(
                        SUM(result),
                        0
                    ) AS total_result,

                    COALESCE(
                        SUM(stake),
                        0
                    ) AS total_stake

                FROM demo_trades

                WHERE demo_username = $1
                `,
                [username]
            );


        const winsResult =
            await pool.query(
                `
                SELECT COUNT(*) AS wins

                FROM demo_trades

                WHERE demo_username = $1
                AND result > 0
                `,
                [username]
            );


        const lossesResult =
            await pool.query(
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

            user: userResult.rows[0],

            statistics: {

                tradeCount:
                    Number(
                        tradesResult.rows[0].trade_count
                    ),

                totalResult:
                    Number(
                        tradesResult.rows[0].total_result
                    ),

                totalStake:
                    Number(
                        tradesResult.rows[0].total_stake
                    ),

                wins:
                    Number(
                        winsResult.rows[0].wins
                    ),

                losses:
                    Number(
                        lossesResult.rows[0].losses
                    )

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


/*
==================================================
ALL DEMO USERS
==================================================

For the administration/demo dashboard.
No password hashes are returned.
==================================================
*/

app.get("/demo-data", async (req, res) => {

    try {

        const users = await pool.query(
            `
            SELECT
                id,
                demo_username,
                demo_balance,
                created_at

            FROM demo_users

            ORDER BY id DESC
            `
        );


        res.json({

            success: true,

            users: users.rows

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            error: "Unable to load demo data"

        });

    }

});


/*
==================================================
ALL RECENT DEMO TRADES
==================================================
*/

app.get("/demo-trades", async (req, res) => {

    try {

        const trades = await pool.query(
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

            trades: trades.rows

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            error: "Unable to load demo trades"

        });

    }

});


/*
==================================================
START SERVER
==================================================
*/

async function startServer() {

    try {

        await setupDatabase();


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

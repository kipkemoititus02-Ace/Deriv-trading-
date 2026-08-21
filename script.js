const DEMO_USERNAME = "demo_user";
const DEMO_PASSWORD = "DemoPass123";

const loginForm =
    document.getElementById("loginForm");

const usernameInput =
    document.getElementById("username");

const passwordInput =
    document.getElementById("password");

const loginButton =
    document.getElementById("loginButton");

const message =
    document.getElementById("message");


/*
==================================================
DISPLAY MESSAGE
==================================================
*/

function showMessage(text, type) {

    message.textContent = text;

    message.className =
        "message " + type;

}


/*
==================================================
CREATE DEMO ACCOUNT
==================================================

The server stores only a password hash.
The actual demo password is never stored
as plain text in PostgreSQL.
==================================================
*/

async function createDemoAccount() {

    try {

        const response = await fetch(
            "/api/demo-user",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    username:
                        DEMO_USERNAME,

                    password:
                        DEMO_PASSWORD

                })
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Demo account setup failed:",
                data
            );

            return false;
        }


        console.log(
            "Demo account ready."
        );

        return true;


    } catch (error) {

        console.error(
            "Unable to connect to demo server:",
            error
        );

        return false;
    }
}


/*
==================================================
DEMO LOGIN
==================================================
*/

async function loginDemoAccount() {

    const username =
        usernameInput.value.trim();

    const password =
        passwordInput.value;


    if (!username || !password) {

        showMessage(
            "Enter the demo username and password.",
            "error"
        );

        return;
    }


    loginButton.disabled = true;

    loginButton.textContent =
        "Connecting...";


    showMessage(
        "Checking demo account...",
        "loading"
    );


    try {

        const response = await fetch(
            "/api/demo-login",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    username,
                    password

                })
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            showMessage(
                data.message ||
                "Invalid demo login.",
                "error"
            );

            loginButton.disabled = false;

            loginButton.textContent =
                "Enter Demo Account";

            return;
        }


        /*
        Store only non-sensitive demo
        session information.
        */

        sessionStorage.setItem(
            "demoLoggedIn",
            "true"
        );

        sessionStorage.setItem(
            "demoUsername",
            data.user.username
        );


        showMessage(
            "Demo login successful. Opening dashboard...",
            "success"
        );


        setTimeout(() => {

            window.location.href =
                "/dashboard";

        }, 700);


    } catch (error) {

        console.error(error);

        showMessage(
            "Unable to connect to the demo server.",
            "error"
        );


        loginButton.disabled = false;

        loginButton.textContent =
            "Enter Demo Account";
    }
}


/*
==================================================
FORM SUBMISSION
==================================================
*/

loginForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        loginDemoAccount();

    }
);


/*
==================================================
INITIALIZE DEMO ACCOUNT
==================================================
*/

async function initializeDemo() {

    usernameInput.value =
        DEMO_USERNAME;

    passwordInput.value =
        DEMO_PASSWORD;


    showMessage(
        "Preparing demo account...",
        "loading"
    );


    const ready =
        await createDemoAccount();


    if (ready) {

        showMessage(
            "Demo account ready.",
            "success"
        );

    } else {

        showMessage(
            "Demo server unavailable.",
            "error"
        );

    }
}


initializeDemo();

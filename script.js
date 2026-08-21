const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value.trim();

    message.textContent = "";

    if (!username || !password) {

        message.textContent =
            "Please enter your demo credentials.";

        message.style.color = "#d40000";

        return;
    }


    /*
     * DEMO / TRAINING LOGIN ONLY
     *
     * These are fictional credentials.
     *
     * Do NOT enter real Deriv credentials.
     */

    const demoUsername = "demo_user";

    const demoPassword = "DemoPass123";


    if (
        username === demoUsername &&
        password === demoPassword
    ) {

        message.textContent =
            "Demo login successful.";

        message.style.color =
            "#16803c";


        sessionStorage.setItem(
            "demoLoggedIn",
            "true"
        );


        sessionStorage.setItem(
            "demoUsername",
            username
        );


        setTimeout(function () {

            window.location.href =
                "dashboard.html";

        }, 700);


    } else {

        message.textContent =
            "Invalid demo credentials.";

        message.style.color =
            "#d40000";

    }

});

const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user_id = document.getElementById("user_id").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ user_id, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Login failed!");
            return;
        }

        // Save user details
        localStorage.setItem("user_id", data.user_id || user_id);

        localStorage.setItem("user", JSON.stringify({
            user_id: data.user_id || user_id,
            role: data.role
        }));

        console.log("Logged in:", data);

        // Redirect based on role
        if (data.role === "admin") {
            window.location.href = "/admin.html";
        } else if (data.role === "student") {
            window.location.href = "/student.html";
        } else {
            alert("Invalid user role!");
        }

    } catch (error) {
        console.error("Login error:", error);
        alert("Something went wrong. Please try again.");
    }
});

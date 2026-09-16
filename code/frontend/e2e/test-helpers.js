// E2E test helpers for authenticating page sessions.

export async function authenticatePage(page) {
  let token = "e2e-test-token";
  let user = {
    id: "e2e-user",
    username: "Athlete",
    email: "athlete@gmail.com",
    display_name: "Athlete",
  };

  try {
    const res = await page.request.post("http://localhost:8000/api/auth/google", {
      data: {
        token: "google-oauth-token-e2e-valid-token",
        email: "e2e_athlete@gmail.com",
        name: "E2E Athlete",
      },
    });
    if (res.ok()) {
      const data = await res.json();
      token = data.access_token;
      user = data.user;
    }
  } catch (_) {}

  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("activeTab", "workout");
    },
    { token, user }
  );
}

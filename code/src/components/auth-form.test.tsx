import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth-form";
import { saveDraft } from "@/lib/draft-storage";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const signInWithEmail = vi.fn();
const signUpWithEmail = vi.fn();
const signInWithGoogle = vi.fn();
vi.mock("@/lib/services/auth", () => ({
  signInWithEmail: (...args: unknown[]) => signInWithEmail(...args),
  signUpWithEmail: (...args: unknown[]) => signUpWithEmail(...args),
  signInWithGoogle: () => signInWithGoogle(),
  authErrorMessage: (error: { code?: string }) =>
    ({
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/invalid-email": "That email address doesn't look right.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/email-already-in-use": "An account already exists for that email.",
      "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
    })[error?.code ?? ""] ?? "Something went wrong. Please try again.",
}));

const email = () => screen.getByLabelText("Email");
const password = () => screen.getByLabelText("Password");
const submit = (name: RegExp | string = "Sign in") => screen.getByRole("button", { name });
const google = () => screen.getByRole("button", { name: /Continue with Google|Waiting for Google/ });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

beforeEach(() => {
  replace.mockReset();
  signInWithEmail.mockReset().mockResolvedValue({});
  signUpWithEmail.mockReset().mockResolvedValue({});
  signInWithGoogle.mockReset().mockResolvedValue({});
  window.sessionStorage.clear();
});

describe("what each page says", () => {
  it("welcomes someone back on sign-in", () => {
    render(<AuthForm mode="sign-in" />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up");
  });

  it("invites a new person to create an account on sign-up, with an optional name", () => {
    render(<AuthForm mode="sign-up" />);
    expect(screen.getByRole("heading", { level: 1, name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name (optional)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("has no name field when signing in", () => {
    render(<AuthForm mode="sign-in" />);
    expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();
  });
});

describe("Continue with Google", () => {
  it("comes first, and carries Google's logo as decoration beside its words", () => {
    render(<AuthForm mode="sign-in" />);
    const button = google();
    expect(button).toHaveAccessibleName("Continue with Google");
    const logo = button.querySelector("svg");
    expect(logo).toHaveAttribute("aria-hidden", "true");
    // All four of the mark's colours, unaltered.
    const fills = [...logo!.querySelectorAll("path")].map((p) => p.getAttribute("fill"));
    expect(fills).toEqual(["#EA4335", "#4285F4", "#FBBC05", "#34A853"]);
    // Before the email form in the page.
    expect(button.compareDocumentPosition(email()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("signs in and goes to the dashboard", async () => {
    render(<AuthForm mode="sign-in" />);
    fireEvent.click(google());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("works the same from the sign-up page", async () => {
    render(<AuthForm mode="sign-up" />);
    fireEvent.click(google());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("says it is waiting, and holds both ways of signing in meanwhile", async () => {
    signInWithGoogle.mockReturnValue(new Promise(() => {}));
    render(<AuthForm mode="sign-in" />);
    fireEvent.click(google());
    expect(await screen.findByRole("button", { name: "Waiting for Google…" })).toBeDisabled();
    expect(submit()).toBeDisabled();
  });

  it("treats closing the Google window as a choice, not an error", async () => {
    signInWithGoogle.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    render(<AuthForm mode="sign-in" />);
    fireEvent.click(google());
    expect(await screen.findByRole("status")).toHaveTextContent(/closed before finishing/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(google()).toBeEnabled();
  });

  it("shows a real failure as an alert", async () => {
    signInWithGoogle.mockRejectedValue({ code: "auth/network-request-failed" });
    render(<AuthForm mode="sign-in" />);
    fireEvent.click(google());
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});

describe("checking the form", () => {
  it("does not scold an empty field before anyone has touched it", () => {
    render(<AuthForm mode="sign-in" />);
    expect(screen.queryByText(/Enter your email/)).not.toBeInTheDocument();
  });

  it("asks for what is missing on submit, and does not call the server", () => {
    render(<AuthForm mode="sign-in" />);
    fireEvent.click(submit());
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it("puts the cursor on the first thing to fix", () => {
    render(<AuthForm mode="sign-in" />);
    fireEvent.click(submit());
    expect(email()).toHaveFocus();

    type(email(), "asha@example.com");
    fireEvent.click(submit());
    expect(password()).toHaveFocus();
  });

  it("ties each message to its field for screen readers", () => {
    render(<AuthForm mode="sign-in" />);
    fireEvent.click(submit());
    expect(email()).toBeInvalid();
    expect(email()).toHaveAccessibleDescription("Enter your email address.");
  });

  it("says when an email does not look like one, once the person leaves the field", () => {
    render(<AuthForm mode="sign-in" />);
    type(email(), "asha@");
    expect(screen.queryByText(/doesn't look right/)).not.toBeInTheDocument();
    fireEvent.blur(email());
    expect(screen.getByText("That email address doesn't look right.")).toBeInTheDocument();
  });

  it("clears the message as soon as the field is right", () => {
    render(<AuthForm mode="sign-in" />);
    type(email(), "asha@");
    fireEvent.blur(email());
    type(email(), "asha@example.com");
    expect(screen.queryByText(/doesn't look right/)).not.toBeInTheDocument();
    expect(email()).toBeValid();
  });

  it("asks for a password of six characters when signing up, not when signing in", () => {
    const { unmount } = render(<AuthForm mode="sign-up" />);
    type(email(), "asha@example.com");
    type(password(), "abc");
    fireEvent.click(submit("Create account"));
    expect(screen.getByText("Use at least 6 characters.")).toBeInTheDocument();
    expect(signUpWithEmail).not.toHaveBeenCalled();
    unmount();

    render(<AuthForm mode="sign-in" />);
    type(email(), "asha@example.com");
    type(password(), "abc"); // an existing account may have any password
    fireEvent.click(submit());
    expect(signInWithEmail).toHaveBeenCalled();
  });

  it("shows a tick on the sign-up password hint once it is long enough", () => {
    render(<AuthForm mode="sign-up" />);
    const hint = () => screen.getByText("At least 6 characters").parentElement!;
    expect(hint().querySelector("svg")).toBeNull();
    type(password(), "secret1");
    expect(hint().querySelector("svg")).not.toBeNull();
  });
});

describe("the password", () => {
  it("is hidden until asked for, and can be hidden again", () => {
    render(<AuthForm mode="sign-in" />);
    expect(password()).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password()).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password()).toHaveAttribute("type", "password");
  });

  it("tells a password manager what it is", () => {
    const { unmount } = render(<AuthForm mode="sign-in" />);
    expect(password()).toHaveAttribute("autocomplete", "current-password");
    unmount();
    render(<AuthForm mode="sign-up" />);
    expect(password()).toHaveAttribute("autocomplete", "new-password");
  });
});

describe("signing in with email", () => {
  it("sends the email without stray spaces, and goes to the dashboard", async () => {
    render(<AuthForm mode="sign-in" />);
    type(email(), "  asha@example.com ");
    type(password(), "secret1");
    fireEvent.click(submit());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(signInWithEmail).toHaveBeenCalledWith("asha@example.com", "secret1");
  });

  it("continues into the trip wizard when there is a trip waiting from the landing page", async () => {
    saveDraft({ destination: "Japan" });
    render(<AuthForm mode="sign-in" />);
    type(email(), "asha@example.com");
    type(password(), "secret1");
    fireEvent.click(submit());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/trips/new"));
  });

  it("says it is working, and holds both buttons", async () => {
    signInWithEmail.mockReturnValue(new Promise(() => {}));
    render(<AuthForm mode="sign-in" />);
    type(email(), "asha@example.com");
    type(password(), "secret1");
    fireEvent.click(submit());

    expect(await screen.findByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(google()).toBeDisabled();
  });

  it("shows a wrong password as one alert, without saying which part was wrong", async () => {
    signInWithEmail.mockRejectedValue({ code: "auth/invalid-credential" });
    render(<AuthForm mode="sign-in" />);
    type(email(), "asha@example.com");
    type(password(), "wrong-one");
    fireEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(submit()).toBeEnabled();
    expect(email()).toBeValid();
  });

  it("clears that alert when the person starts correcting it", async () => {
    signInWithEmail.mockRejectedValue({ code: "auth/invalid-credential" });
    render(<AuthForm mode="sign-in" />);
    type(email(), "asha@example.com");
    type(password(), "wrong-one");
    fireEvent.click(submit());
    await screen.findByRole("alert");

    type(password(), "wrong-on");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("creating an account", () => {
  it("sends the name, email and password, and goes to the dashboard", async () => {
    render(<AuthForm mode="sign-up" />);
    type(screen.getByLabelText("Name (optional)"), " Asha ");
    type(email(), "asha@example.com");
    type(password(), "secret1");
    fireEvent.click(submit("Create account"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(signUpWithEmail).toHaveBeenCalledWith("asha@example.com", "secret1", "Asha");
  });

  it("leaves the name out when it was not given", async () => {
    render(<AuthForm mode="sign-up" />);
    type(email(), "asha@example.com");
    type(password(), "secret1");
    fireEvent.click(submit("Create account"));
    await waitFor(() => expect(signUpWithEmail).toHaveBeenCalledWith("asha@example.com", "secret1", undefined));
  });

  it("puts 'already exists' on the email, with a way to sign in instead", async () => {
    signUpWithEmail.mockRejectedValue({ code: "auth/email-already-in-use" });
    render(<AuthForm mode="sign-up" />);
    type(email(), "asha@example.com");
    type(password(), "secret1");
    fireEvent.click(submit("Create account"));

    await screen.findByText(/An account already exists/);
    expect(email()).toBeInvalid();
    expect(screen.getByRole("link", { name: "Sign in instead" })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("puts a weak-password rejection on the password field", async () => {
    signUpWithEmail.mockRejectedValue({ code: "auth/weak-password" });
    render(<AuthForm mode="sign-up" />);
    type(email(), "asha@example.com");
    type(password(), "secret1");
    fireEvent.click(submit("Create account"));

    await waitFor(() => expect(password()).toBeInvalid());
    expect(password()).toHaveAccessibleDescription("Password should be at least 6 characters.");
  });
});

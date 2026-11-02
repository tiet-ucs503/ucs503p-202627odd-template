import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/site-header";

let pathname = "/dashboard";
let user: { displayName: string | null; email: string | null } | null = { displayName: "Asha", email: "a@example.com" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user, loading: false }) }));
const signOutUser = vi.fn();
vi.mock("@/lib/services/auth", () => ({ signOutUser: () => signOutUser() }));

const nav = () => screen.getByRole("navigation", { name: "Main" });

beforeEach(() => {
  window.sessionStorage.clear();
  signOutUser.mockReset().mockResolvedValue(undefined);
  pathname = "/dashboard";
  user = { displayName: "Asha", email: "a@example.com" };
});

describe("the main navigation", () => {
  it("offers the two places a traveller works from", () => {
    render(<SiteHeader />);
    expect(nav().querySelectorAll("a")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Trips" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Travis" })).toHaveAttribute("href", "/travis");
  });

  it("marks Trips as the current page on the dashboard", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Trips" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Travis" })).not.toHaveAttribute("aria-current");
  });

  it("keeps Trips marked while a trip is open, since the trip belongs to it", () => {
    pathname = "/trips/abc123";
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Trips" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps Trips marked on the new-trip wizard", () => {
    pathname = "/trips/new";
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Trips" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Travis as the current page on its own page", () => {
    pathname = "/travis";
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Travis" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Trips" })).not.toHaveAttribute("aria-current");
  });

  it("does not mistake a similarly named path for a section", () => {
    pathname = "/travis-fan-club";
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Travis" })).not.toHaveAttribute("aria-current");
  });

  it("marks neither on a page outside both sections", () => {
    pathname = "/somewhere-else";
    render(<SiteHeader />);
    expect(nav().querySelectorAll("[aria-current]")).toHaveLength(0);
  });

  it("is not shown to someone who is signed out", () => {
    user = null;
    render(<SiteHeader />);
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("still offers a way to start a new trip", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /New trip/ })).toHaveAttribute("href", "/trips/new");
  });
});

describe("signing out", () => {
  it("forgets every Travis conversation in the tab, so the next person never sees it", async () => {
    window.sessionStorage.setItem("tripease:travis:v1:asha", "[]");
    window.sessionStorage.setItem("tripease:travis:v1:ben", "[]");
    window.sessionStorage.setItem("something-else", "keep");
    render(<SiteHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(window.sessionStorage.getItem("tripease:travis:v1:asha")).toBeNull());
    expect(window.sessionStorage.getItem("tripease:travis:v1:ben")).toBeNull();
    expect(window.sessionStorage.getItem("something-else")).toBe("keep");
  });

  it("leaves the conversation alone if signing out failed, since the person is still signed in", async () => {
    signOutUser.mockRejectedValue(new Error("network"));
    window.sessionStorage.setItem("tripease:travis:v1:asha", "[]");
    render(<SiteHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOutUser).toHaveBeenCalled());

    expect(window.sessionStorage.getItem("tripease:travis:v1:asha")).toBe("[]");
  });
});

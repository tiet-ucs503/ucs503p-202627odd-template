import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StartCard } from "@/components/dashboard/start-card";
import { PLAN_PHOTO, TRAVIS_PHOTO } from "@/lib/destination-photos";

describe("StartCard", () => {
  it("is a single link to where it leads, named by what it does", () => {
    render(
      <StartCard
        href="/travis"
        title="Ask Travis"
        description="You're still deciding."
        cta="Talk to Travis"
        photo={TRAVIS_PHOTO}
      />,
    );

    const link = screen.getByRole("link", { name: /Ask Travis/ });
    expect(link).toHaveAttribute("href", "/travis");
  });

  it("says who it is for and what happens next", () => {
    render(
      <StartCard
        href="/trips/new"
        title="Plan a trip"
        description="You know where you're going."
        cta="Start planning"
        photo={PLAN_PHOTO}
      />,
    );

    expect(screen.getByRole("heading", { name: "Plan a trip" })).toBeInTheDocument();
    expect(screen.getByText("You know where you're going.")).toBeInTheDocument();
    expect(screen.getByText("Start planning")).toBeInTheDocument();
  });

  it("treats its photo as decoration, so the link's name is just the words", () => {
    render(
      <StartCard href="/trips/new" title="Plan a trip" description="d" cta="Go" photo={PLAN_PHOTO} />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAccessibleName("Plan a trip d Go");
  });
});

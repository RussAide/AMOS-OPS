import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AccessDeniedPage } from "./access-denied-page";
import { NotFoundPage } from "./not-found-page";

describe("application navigation boundaries", () => {
  it("renders an explicit Not Found page with the unmatched path", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/does-not-exist"]}>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(markup).toContain("Page not found");
    expect(markup).toContain("/does-not-exist");
    expect(markup).toContain('href="/"');
  });

  it("renders a role-scope denial without exposing a protected page", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <AccessDeniedPage reason="Synthetic role-scope denial." />
      </MemoryRouter>,
    );
    expect(markup).toContain("Access denied");
    expect(markup).toContain("Synthetic role-scope denial.");
    expect(markup).toContain('href="/"');
  });
});

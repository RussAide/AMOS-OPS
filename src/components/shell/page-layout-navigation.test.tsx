import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SIDEBAR_NAVIGATION } from "@/data/sidebar-navigation";
import {
  ASK_AMOS_LAUNCHER_PATH,
  PageLayout,
  shouldShowAskAmosLauncher,
} from "./page-layout";

function renderPage(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <PageLayout hideHero>
        <div>My Work content</div>
      </PageLayout>
    </MemoryRouter>,
  );
}

describe("Ask AMOS My Work navigation", () => {
  it("surfaces the launcher on both supported My Work landing routes", () => {
    expect(shouldShowAskAmosLauncher("/workflows/my-work-today")).toBe(true);
    expect(shouldShowAskAmosLauncher("/my-work-today")).toBe(true);

    for (const path of ["/workflows/my-work-today", "/my-work-today"]) {
      const markup = renderPage(path);
      expect(markup).toContain('data-testid="ask-amos-launcher"');
      expect(markup).toContain("Open Ask AMOS");
      expect(markup).toContain(`href="${ASK_AMOS_LAUNCHER_PATH}"`);
      expect(markup).toContain("w-full");
      expect(markup).toContain("md:w-auto");
    }
  });

  it("does not add the primary launcher outside the My Work landing page", () => {
    expect(shouldShowAskAmosLauncher("/workflows/my-work-assigned")).toBe(false);
    expect(
      shouldShowAskAmosLauncher("/workflows/intelligence-assistant"),
    ).toBe(false);
    expect(renderPage("/workflows/my-work-assigned")).not.toContain(
      'data-testid="ask-amos-launcher"',
    );
  });

  it("keeps the launcher and existing sidebar entry on the canonical Ask AMOS route", () => {
    expect(ASK_AMOS_LAUNCHER_PATH).toBe("/workflows/intelligence-assistant");

    const myWork = SIDEBAR_NAVIGATION.find((node) => node.id === "my-work");
    expect(myWork?.type).toBe("group");
    if (!myWork || myWork.type !== "group") {
      throw new Error("My Work sidebar group is missing.");
    }

    const askAmos = myWork.children.find(
      (node) => node.id === "my-work-ask-amos",
    );
    expect(askAmos).toMatchObject({
      type: "link",
      label: "Ask AMOS",
      href: ASK_AMOS_LAUNCHER_PATH,
    });
  });
});

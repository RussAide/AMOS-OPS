import {
  Home,
  ListTodo,
  Lightbulb,
  PanelsTopLeft,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { runtimeConfig } from "@/config/runtime";
import { ROLE_DEFINITIONS } from "@/constants/roles";
import { useAuth } from "@/hooks/use-auth";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
  type SidebarNavGroup,
  type SidebarNavLink,
  type SidebarNavNode,
} from "@/data/sidebar-navigation";
import "./universal-footer-nav.css";

type FooterItem = {
  id: string;
  label: string;
  fullLabel: string;
  href: string;
  icon: typeof Home;
  active?: boolean;
};

const DIVISION_GROUP: Record<string, string> = {
  eo: "executive-office",
  gro: "gro",
  bhc: "bhc",
  gad: "gad",
};

function pathMatches(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function compactLabel(label: string): string {
  return label.length <= 14 ? label : `${label.slice(0, 13)}…`;
}

function groupById(
  nodes: readonly SidebarNavNode[],
  id: string,
): SidebarNavGroup | undefined {
  return nodes.find(
    (node): node is SidebarNavGroup => node.type === "group" && node.id === id,
  );
}

function firstLink(group: SidebarNavGroup | undefined): SidebarNavLink | undefined {
  return group ? flattenSidebarLinks(group.children)[0] : undefined;
}

function dedupeByHref(links: readonly SidebarNavLink[]): SidebarNavLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

/**
 * AMOS-OPS adapter for the IntraLink Universal Footer Navigation Standard v1.0.
 *
 * Shared contract:
 * Home | primary work | primary intelligence | contextual workspace | More
 *
 * Route visibility is derived from the existing permission-trimmed sidebar.
 * The footer never creates an authorization path that the host does not expose.
 */
export function UniversalFooterNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, workspace } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const firstMoreRef = useRef<HTMLButtonElement | null>(null);

  const runtimeMode = workspace === "training" ? "demo" : "production";
  const navigation = useMemo(
    () => getSidebarNavigation(currentRole, runtimeMode),
    [currentRole, runtimeMode],
  );

  const homeGroup = groupById(navigation, "home");
  const workGroup = groupById(navigation, "my-work");
  const roleDef = ROLE_DEFINITIONS.find((role) => role.id === currentRole);
  const workspaceGroup = groupById(
    navigation,
    DIVISION_GROUP[roleDef?.division ?? ""] ?? "",
  );

  const homeLink = firstLink(homeGroup);
  const workLinks = workGroup ? flattenSidebarLinks(workGroup.children) : [];
  const askAmosLink =
    workLinks.find((link) => link.id === "my-work-ask-amos") ??
    workLinks.find((link) => link.href.includes("intelligence-assistant"));
  const myWorkLink =
    workLinks.find((link) => link.id !== askAmosLink?.id) ?? firstLink(workGroup);
  const workspaceLink = firstLink(workspaceGroup) ?? myWorkLink ?? homeLink;

  const primary = useMemo<FooterItem[]>(() => {
    const items = [
      homeLink && {
        id: "home",
        label: "Home",
        fullLabel: "Home",
        href: homeLink.href,
        icon: Home,
      },
      myWorkLink && {
        id: "my-work",
        label: "My Work",
        fullLabel: "My Work",
        href: myWorkLink.href,
        icon: ListTodo,
      },
      askAmosLink && {
        id: "ask-amos",
        label: "Ask AMOS",
        fullLabel: "Ask AMOS",
        href: askAmosLink.href,
        icon: Lightbulb,
      },
      workspaceLink && {
        id: "workspace",
        label: "Workspace",
        fullLabel: workspaceGroup?.label ?? "Workspace",
        href: workspaceLink.href,
        icon: PanelsTopLeft,
      },
    ].filter((item): item is FooterItem => Boolean(item));

    return items.map((item) => ({
      ...item,
      active:
        item.id === "workspace"
          ? Boolean(
              workspaceGroup &&
                flattenSidebarLinks(workspaceGroup.children).some((link) =>
                  pathMatches(link.href, location.pathname),
                ),
            )
          : pathMatches(item.href, location.pathname),
    }));
  }, [
    askAmosLink,
    homeLink,
    location.pathname,
    myWorkLink,
    workspaceGroup,
    workspaceLink,
  ]);

  const primaryHrefs = new Set(primary.map((item) => item.href));
  const secondaryLinks = useMemo(() => {
    return dedupeByHref(flattenSidebarLinks(navigation)).filter(
      (link) => !primaryHrefs.has(link.href),
    );
  }, [navigation, primaryHrefs]);

  const moreActive =
    !primary.some((item) => item.active) &&
    secondaryLinks.some((link) => pathMatches(link.href, location.pathname));

  useEffect(() => {
    if (!moreOpen) return;
    const focusTimer = window.setTimeout(() => firstMoreRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const go = (href: string) => {
    navigate(href);
    setMoreOpen(false);
  };

  return (
    <>
      <nav
        className="amos-universal-footer"
        aria-label="AMOS-OPS mobile navigation"
        data-shared-platform-contract="intralink-universal-footer-v1"
      >
        {primary.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`amos-universal-footer__item ${item.active ? "is-active" : ""}`}
              aria-current={item.active ? "page" : undefined}
              aria-label={item.fullLabel}
              title={item.fullLabel}
              onClick={() => go(item.href)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`amos-universal-footer__item ${moreActive || moreOpen ? "is-active" : ""}`}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          aria-controls="amos-universal-footer-more"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="amos-universal-footer__backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setMoreOpen(false);
          }}
        >
          <section
            id="amos-universal-footer-more"
            role="dialog"
            aria-modal="true"
            aria-label="More AMOS-OPS destinations"
            className="amos-universal-footer__sheet"
          >
            <div className="amos-universal-footer__sheet-header">
              <div>
                <p className="amos-universal-footer__eyebrow">AMOS-OPS</p>
                <h2>More</h2>
              </div>
              <button
                type="button"
                className="amos-universal-footer__close"
                aria-label="Close More navigation"
                onClick={() => setMoreOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="amos-universal-footer__more-list">
              {secondaryLinks.map((link, index) => {
                const active = pathMatches(link.href, location.pathname);
                return (
                  <button
                    key={link.href}
                    ref={index === 0 ? firstMoreRef : undefined}
                    type="button"
                    className={`amos-universal-footer__more-item ${active ? "is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    aria-label={link.label}
                    title={link.label}
                    onClick={() => go(link.href)}
                  >
                    <span>{compactLabel(link.label)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

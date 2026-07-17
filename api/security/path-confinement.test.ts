import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertPathConfined,
  PathConfinementError,
} from "./path-confinement";

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "amos-path-confinement-"));
  temporaryRoots.push(root);
  return root;
}

function expectCode(callback: () => unknown, code: string): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(PathConfinementError);
    expect((error as PathConfinementError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("symlink-safe path confinement", () => {
  it("accepts existing regular descendants and enforces their type", () => {
    const root = temporaryRoot();
    const directory = path.join(root, "backups", "production");
    const file = path.join(directory, "operational.amosbackup");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file, "ciphertext");

    expect(assertPathConfined(root, directory, { type: "directory" })).toEqual({
      root,
      candidate: directory,
      exists: true,
      existingAncestor: directory,
    });
    expect(assertPathConfined(root, file, { type: "file" })).toMatchObject({
      candidate: file,
      exists: true,
      existingAncestor: file,
    });
    expectCode(
      () => assertPathConfined(root, file, { type: "directory" }),
      "PATH_CANDIDATE_TYPE_MISMATCH",
    );
  });

  it("accepts missing trailing descendants but identifies the verified ancestor", () => {
    const root = temporaryRoot();
    const existing = path.join(root, "uploads");
    const future = path.join(existing, "production", "2026", "document.enc");
    fs.mkdirSync(existing);

    expect(assertPathConfined(root, future)).toEqual({
      root,
      candidate: future,
      exists: false,
      existingAncestor: existing,
    });
    expectCode(
      () => assertPathConfined(root, future, { allowMissing: false }),
      "PATH_CANDIDATE_MISSING",
    );
  });

  it("rejects a missing or non-directory root", () => {
    const parent = temporaryRoot();
    const missing = path.join(parent, "missing");
    const file = path.join(parent, "file");
    fs.writeFileSync(file, "not a directory");

    expectCode(
      () => assertPathConfined(missing, path.join(missing, "child")),
      "PATH_ROOT_MISSING",
    );
    expectCode(
      () => assertPathConfined(file, path.join(file, "child")),
      "PATH_ROOT_NOT_DIRECTORY",
    );
  });

  it("rejects the root itself and lexical traversal outside the root", () => {
    const root = temporaryRoot();
    expectCode(() => assertPathConfined(root, root), "PATH_OUTSIDE_ROOT");
    expect(assertPathConfined(root, root, { allowRoot: true })).toMatchObject({
      candidate: root,
      exists: true,
    });
    expectCode(
      () => assertPathConfined(root, path.join(root, "..", "outside")),
      "PATH_OUTSIDE_ROOT",
    );
  });

  it("rejects final and intermediate symbolic links, including links that stay inside", () => {
    const parent = temporaryRoot();
    const root = path.join(parent, "root");
    const outside = path.join(parent, "outside");
    const inside = path.join(root, "inside");
    fs.mkdirSync(inside, { recursive: true });
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(root, "outside-link"), "dir");
    fs.symlinkSync(inside, path.join(root, "inside-link"), "dir");
    fs.symlinkSync(path.join(inside, "missing.enc"), path.join(root, "file-link"));

    for (const candidate of [
      path.join(root, "outside-link", "record.enc"),
      path.join(root, "inside-link", "record.enc"),
      path.join(root, "file-link"),
    ]) {
      expectCode(
        () => assertPathConfined(root, candidate),
        "PATH_SYMLINK_REJECTED",
      );
    }
  });

  it("rejects a symlink root and a root reached through a symlinked ancestor", () => {
    const parent = temporaryRoot();
    const realRoot = path.join(parent, "real-root");
    const rootLink = path.join(parent, "root-link");
    fs.mkdirSync(path.join(realRoot, "nested"), { recursive: true });
    fs.symlinkSync(realRoot, rootLink, "dir");

    expectCode(
      () => assertPathConfined(rootLink, path.join(rootLink, "child")),
      "PATH_SYMLINK_REJECTED",
    );
    expectCode(
      () =>
        assertPathConfined(
          path.join(rootLink, "nested"),
          path.join(rootLink, "nested", "child"),
        ),
      "PATH_SYMLINK_REJECTED",
    );
  });

  it("rejects a non-directory existing intermediate component", () => {
    const root = temporaryRoot();
    const file = path.join(root, "not-a-directory");
    fs.writeFileSync(file, "content");

    expectCode(
      () => assertPathConfined(root, path.join(file, "child")),
      "PATH_COMPONENT_NOT_DIRECTORY",
    );
  });
});

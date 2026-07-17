import fs from "node:fs";
import path from "node:path";

export type ConfinedPathType = "any" | "file" | "directory";

export interface PathConfinementOptions {
  /** Permit the candidate to be the root itself. Defaults to false. */
  allowRoot?: boolean;
  /** Permit a missing candidate (and missing trailing components). Defaults to true. */
  allowMissing?: boolean;
  /** Required type when the candidate already exists. Defaults to any. */
  type?: ConfinedPathType;
}

export interface ConfinedPath {
  /** Canonical, existing root. */
  readonly root: string;
  /** Absolute candidate reconstructed beneath the canonical root. */
  readonly candidate: string;
  /** Whether the complete candidate existed when it was checked. */
  readonly exists: boolean;
  /** Deepest existing, verified non-symlink component. */
  readonly existingAncestor: string;
}

export type PathConfinementErrorCode =
  | "PATH_ROOT_MISSING"
  | "PATH_ROOT_NOT_DIRECTORY"
  | "PATH_SYMLINK_REJECTED"
  | "PATH_OUTSIDE_ROOT"
  | "PATH_COMPONENT_NOT_DIRECTORY"
  | "PATH_CANDIDATE_MISSING"
  | "PATH_CANDIDATE_TYPE_MISMATCH";

export class PathConfinementError extends Error {
  constructor(
    public readonly code: PathConfinementErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PathConfinementError";
  }
}

function missing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function lstatExisting(filePath: string): fs.Stats {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (missing(error)) {
      throw new PathConfinementError(
        "PATH_ROOT_MISSING",
        `Confinement root does not exist: ${filePath}`,
      );
    }
    throw error;
  }
}

function assertRequiredType(
  candidate: string,
  stats: fs.Stats,
  requiredType: ConfinedPathType,
): void {
  if (
    requiredType === "any" ||
    (requiredType === "file" && stats.isFile()) ||
    (requiredType === "directory" && stats.isDirectory())
  ) {
    return;
  }
  throw new PathConfinementError(
    "PATH_CANDIDATE_TYPE_MISMATCH",
    `Confined path is not the required ${requiredType}: ${candidate}`,
  );
}

/**
 * Validate an existing or future path beneath an existing canonical directory.
 *
 * Every existing component is inspected with lstat and symbolic links are
 * rejected. Missing trailing components are accepted by default, but the
 * caller must still create/open the returned path atomically and without
 * following links; validation alone cannot eliminate a later filesystem race.
 */
export function assertPathConfined(
  root: string,
  candidate: string,
  options: PathConfinementOptions = {},
): ConfinedPath {
  const resolvedRoot = path.resolve(root);
  const rootStats = lstatExisting(resolvedRoot);
  if (rootStats.isSymbolicLink()) {
    throw new PathConfinementError(
      "PATH_SYMLINK_REJECTED",
      `Confinement root must not be a symbolic link: ${resolvedRoot}`,
    );
  }
  if (!rootStats.isDirectory()) {
    throw new PathConfinementError(
      "PATH_ROOT_NOT_DIRECTORY",
      `Confinement root is not a directory: ${resolvedRoot}`,
    );
  }

  const canonicalRoot = fs.realpathSync.native(resolvedRoot);
  if (canonicalRoot !== resolvedRoot) {
    throw new PathConfinementError(
      "PATH_SYMLINK_REJECTED",
      `Confinement root contains a symbolic-link component: ${resolvedRoot}`,
    );
  }

  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(canonicalRoot, resolvedCandidate);
  const allowRoot = options.allowRoot ?? false;
  if (
    (!allowRoot && relative.length === 0) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new PathConfinementError(
      "PATH_OUTSIDE_ROOT",
      `Path is not a permitted descendant of ${canonicalRoot}: ${resolvedCandidate}`,
    );
  }

  const components = relative.length === 0 ? [] : relative.split(path.sep);
  let current = canonicalRoot;
  let existingAncestor = canonicalRoot;
  let candidateStats: fs.Stats | null = rootStats;
  let missingComponent = false;

  for (let index = 0; index < components.length; index += 1) {
    current = path.join(current, components[index]);
    if (missingComponent) continue;

    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(current);
    } catch (error) {
      if (!missing(error)) throw error;
      missingComponent = true;
      candidateStats = null;
      continue;
    }

    if (stats.isSymbolicLink()) {
      throw new PathConfinementError(
        "PATH_SYMLINK_REJECTED",
        `Symbolic-link path component rejected: ${current}`,
      );
    }
    const final = index === components.length - 1;
    if (!final && !stats.isDirectory()) {
      throw new PathConfinementError(
        "PATH_COMPONENT_NOT_DIRECTORY",
        `Existing path component is not a directory: ${current}`,
      );
    }

    const canonicalComponent = fs.realpathSync.native(current);
    if (canonicalComponent !== current) {
      throw new PathConfinementError(
        "PATH_SYMLINK_REJECTED",
        `Path component resolved through a symbolic link: ${current}`,
      );
    }
    existingAncestor = current;
    candidateStats = final ? stats : null;
  }

  const exists = components.length === 0 || !missingComponent;
  if (!exists && options.allowMissing === false) {
    throw new PathConfinementError(
      "PATH_CANDIDATE_MISSING",
      `Confined path does not exist: ${resolvedCandidate}`,
    );
  }
  if (exists && candidateStats) {
    assertRequiredType(resolvedCandidate, candidateStats, options.type ?? "any");
  }

  return {
    root: canonicalRoot,
    candidate: path.join(canonicalRoot, ...components),
    exists,
    existingAncestor,
  };
}

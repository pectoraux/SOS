/**
 * SOS semantic versioning.
 *
 * Mission/Value Model/Context/Autonomy are versioned first-class models
 * (spec/architecture.md §3, spec/sos-meta-model.md). Versioning supports the
 * explicit, parented revision history required by R3 ("Mission evolution") and
 * the W1 acceptance criteria ("change history", "explicit proposals/approved
 * revisions", "parent_version").
 */

export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export function version(major: number, minor: number, patch: number): Version {
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
    throw new Error(`SOS: version components must be integers (${major}.${minor}.${patch})`);
  }
  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error(`SOS: version components must be non-negative (${major}.${minor}.${patch})`);
  }
  return { major, minor, patch };
}

export function versionToString(v: Version): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function parseVersion(s: string): Version {
  const parts = s.split(".");
  if (parts.length !== 3) {
    throw new Error(`SOS: invalid version string "${s}"`);
  }
  const [maj, min, pat] = parts;
  const major = Number.parseInt(maj ?? "", 10);
  const minor = Number.parseInt(min ?? "", 10);
  const patch = Number.parseInt(pat ?? "", 10);
  if ([major, minor, patch].some((n) => !Number.isFinite(n))) {
    throw new Error(`SOS: invalid version string "${s}"`);
  }
  return version(major, minor, patch);
}

export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

export function versionsEqual(a: Version, b: Version): boolean {
  return compareVersions(a, b) === 0;
}

/** True when `child` is a strictly later version than `parent`. */
export function isLaterVersion(child: Version, parent: Version): boolean {
  return compareVersions(child, parent) > 0;
}

export const compareAppVersions = (left: string, right: string): number => {
  const parse = (version: string) => version.split(/[+-]/, 1)[0].split('.').map((part) => Number(part));
  const leftParts = parse(left);
  const rightParts = parse(right);
  if (leftParts.length !== 3 || rightParts.length !== 3 || [...leftParts, ...rightParts].some((part) => !Number.isInteger(part))) {
    return 0;
  }

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
};

export const isAppVersionBelow = (installedVersion: string, targetVersion: string): boolean => {
  if (!installedVersion || !targetVersion) return false;
  return compareAppVersions(installedVersion, targetVersion) < 0;
};

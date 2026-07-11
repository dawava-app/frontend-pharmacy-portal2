/** Mirrors the initials/color fallback used on the Staff Management page,
 *  so a staff member without a photo looks the same in both places. */

const AVATAR_COLORS = [
  '#0f766e', // teal
  '#1d4ed8', // blue
  '#6d28d9', // purple
  '#b91c1c', // red
  '#c2410c', // orange
  '#0369a1', // sky
  '#15803d', // green
];

export function getInitials(name?: string): string {
  if (!name) return 'S';
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function avatarColorFor(name?: string): string {
  if (!name) return AVATAR_COLORS[0];
  const charCode = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[charCode % AVATAR_COLORS.length];
}

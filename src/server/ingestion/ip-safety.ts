import { isIP } from "node:net";

/** IPv4 ranges that must never be reachable from article fetching. */
function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** Rewrites a trailing dotted quad, as in `::ffff:127.0.0.1`, into the two hex groups it stands for. */
function foldDottedSuffix(address: string): string | null {
  const dotted = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!dotted) return address;
  const octets = dotted.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return `${address.slice(0, dotted.index)}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
}

/** Expands any IPv6 form, including `::` compression, into its eight 16-bit groups. */
function ipv6Groups(value: string): number[] | null {
  const address = foldDottedSuffix(value);
  if (address === null) return null;
  const [head, tail, ...rest] = address.split("::");
  if (rest.length) return null;
  const parse = (part: string) => (part ? part.split(":").map((group) => Number.parseInt(group, 16)) : []);
  const leading = parse(head);
  const trailing = tail === undefined ? [] : parse(tail);
  const groups = tail === undefined ? leading : [...leading, ...Array(8 - leading.length - trailing.length).fill(0), ...trailing];
  if (groups.length !== 8 || groups.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) return null;
  return groups;
}

/** Returns the IPv4 address an IPv6 form embeds, so mapped and tunneled addresses cannot bypass the IPv4 rules. */
function embeddedIpv4(groups: number[]): string | null {
  const toDotted = (high: number, low: number) => `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (deprecated IPv4-compatible).
  if (groups.slice(0, 5).every((group) => group === 0) && (groups[5] === 0xffff || groups[5] === 0)) return toDotted(groups[6], groups[7]);
  // 2002:a.b.c.d::/16 (6to4).
  if (groups[0] === 0x2002) return toDotted(groups[1], groups[2]);
  // 64:ff9b::/32 (NAT64, including the 64:ff9b:1::/48 local-use prefix).
  if (groups[0] === 0x0064 && groups[1] === 0xff9b) return toDotted(groups[6], groups[7]);
  return null;
}

function isPrivateIpv6(address: string): boolean {
  const groups = ipv6Groups(address.toLowerCase().split("%")[0]);
  if (!groups) return true;

  const embedded = embeddedIpv4(groups);
  if (embedded) return isPrivateIpv4(embedded);

  const [first] = groups;
  return (
    groups.every((group) => group === 0) ||
    (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) ||
    (first >= 0xfc00 && first <= 0xfdff) ||
    (first >= 0xfe80 && first <= 0xfebf) ||
    first >= 0xff00
  );
}

/** Rejects loopback, link-local, private, carrier-grade NAT, benchmarking, and multicast destinations. */
export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return !isPrivateIpv4(address);
  if (version === 6) return !isPrivateIpv6(address);
  return false;
}

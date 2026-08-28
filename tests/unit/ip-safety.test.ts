import { describe, expect, it } from "vitest";
import { isPublicIp } from "@/server/ingestion/ip-safety";

describe("public address classification", () => {
  it.each([
    "93.184.216.34",
    "1.1.1.1",
    "8.8.8.8",
    "172.15.0.1",
    "172.32.0.1",
    "192.0.1.1",
    "198.20.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ])("accepts the routable address %s", (address) => expect(isPublicIp(address)).toBe(true));

  it.each([
    ["unspecified", "0.0.0.0"],
    ["loopback", "127.0.0.1"],
    ["private class A", "10.0.0.1"],
    ["private class B", "172.16.0.1"],
    ["private class C", "192.168.1.1"],
    ["link-local", "169.254.169.254"],
    ["carrier-grade NAT", "100.64.0.1"],
    ["Alibaba metadata", "100.100.100.200"],
    ["IETF protocol assignments", "192.0.0.1"],
    ["benchmarking", "198.18.0.1"],
    ["benchmarking upper half", "198.19.255.255"],
    ["multicast", "224.0.0.1"],
    ["broadcast", "255.255.255.255"],
  ])("rejects the %s address %s", (_label, address) => expect(isPublicIp(address)).toBe(false));

  it.each([
    ["unspecified", "::"],
    ["loopback", "::1"],
    ["unique local", "fd00::1"],
    ["unique local lower bound", "fc00::1"],
    ["link-local", "fe80::1"],
    ["link-local upper bound", "febf::1"],
    ["multicast", "ff02::1"],
  ])("rejects the IPv6 %s address %s", (_label, address) => expect(isPublicIp(address)).toBe(false));

  it.each([
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped metadata", "::ffff:169.254.169.254"],
    ["IPv4-mapped hexadecimal loopback", "::ffff:7f00:1"],
    ["IPv4-compatible loopback", "::127.0.0.1"],
    ["6to4 loopback", "2002:7f00:1::1"],
    ["6to4 private", "2002:c0a8:101::1"],
    ["NAT64 loopback", "64:ff9b::127.0.0.1"],
  ])("rejects the %s address %s, which embeds a private IPv4 destination", (_label, address) => expect(isPublicIp(address)).toBe(false));

  it("still accepts IPv6 forms that embed a routable IPv4 address", () => {
    expect(isPublicIp("::ffff:93.184.216.34")).toBe(true);
    expect(isPublicIp("2002:5db8:d822::1")).toBe(true);
  });

  it("rejects anything that is not a valid address", () => {
    for (const value of ["", "not-an-address", "999.1.1.1", "example.test"]) expect(isPublicIp(value)).toBe(false);
  });
});

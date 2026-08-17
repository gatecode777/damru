import Address, { IAddress } from "@/models/Address";
import Branch, { IBranch } from "@/models/Branch";

type Point = { latitude: number; longitude: number };

type ServiceabilityResult =
  | { serviceable: true; branchId: string; branchName: string; distanceKm: number }
  | { serviceable: false; reason: "NO_BRANCH" | "ADDRESS_NOT_FOUND" | "OUT_OF_RANGE"; nearestDistanceKm?: number };

let nextGeocodeAt = 0;

function addressQuery(address: Pick<IAddress, "house" | "area" | "city" | "state" | "pincode">): string {
  return [address.house, address.area, address.city, address.state, address.pincode, "India"]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceKm(a: Point, b: Point): number {
  const earthRadiusKm = 6371;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function geocode(query: string): Promise<Point | null> {
  const baseUrl = process.env.GEOCODING_BASE_URL?.trim() || "https://nominatim.openstreetmap.org";
  const waitMs = Math.max(0, nextGeocodeAt - Date.now());
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  nextGeocodeAt = Date.now() + 1100;

  const url = new URL("search", `${baseUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "in");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": process.env.GEOCODING_USER_AGENT?.trim() || "DamruRestro/1.0 (https://damrurestro.com; info@damrurestro.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const results = await response.json() as Array<{ lat?: string; lon?: string }>;
    const latitude = Number(results[0]?.lat);
    const longitude = Number(results[0]?.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  } catch (error) {
    console.error("Delivery geocoding failed:", error);
    return null;
  }
}

async function geocodeFirst(queries: string[]): Promise<Point | null> {
  const uniqueQueries = [...new Set(queries.map((query) => query.trim()).filter(Boolean))];
  for (const query of uniqueQueries) {
    const point = await geocode(query);
    if (point) return point;
  }
  return null;
}

async function addressPoint(address: IAddress): Promise<Point | null> {
  const query = addressQuery(address);
  if (address.latitude != null && address.longitude != null && address.geocodedAddress === query) {
    return { latitude: address.latitude, longitude: address.longitude };
  }
  const point = await geocodeFirst([
    query,
    [address.area, address.city, address.state, address.pincode, "India"].filter(Boolean).join(", "),
    [address.pincode, address.city, address.state, "India"].filter(Boolean).join(", "),
  ]);
  if (point) {
    await Address.findByIdAndUpdate(address._id, { ...point, geocodedAddress: query, geocodedAt: new Date() });
  }
  return point;
}

async function branchPoint(branch: IBranch): Promise<Point | null> {
  const query = [branch.address, branch.name, "India"].filter(Boolean).join(", ");
  if (branch.latitude != null && branch.longitude != null && branch.geocodedAddress === query) {
    return { latitude: branch.latitude, longitude: branch.longitude };
  }
  const point = await geocodeFirst([
    [branch.address, "India"].filter(Boolean).join(", "),
    query,
    [branch.name, "India"].filter(Boolean).join(", "),
  ]);
  if (point) {
    await Branch.findByIdAndUpdate(branch._id, { ...point, geocodedAddress: query, geocodedAt: new Date() });
  }
  return point;
}

export async function checkDeliveryServiceability(address: IAddress, radiusKm = 10): Promise<ServiceabilityResult> {
  const branches = await Branch.find({ isActive: true, address: { $ne: "" } });
  if (!branches.length) return { serviceable: false, reason: "NO_BRANCH" };

  const destination = await addressPoint(address);
  if (!destination) return { serviceable: false, reason: "ADDRESS_NOT_FOUND" };

  let nearest: { branch: IBranch; distanceKm: number } | null = null;
  const locatedBranches = branches.filter(branch =>
    Number.isFinite(branch.latitude) && Number.isFinite(branch.longitude),
  );

  // Checkout must not wait on a third-party geocoder for every quote. Branch
  // coordinates are managed/persisted separately; use all currently verified
  // locations immediately. Only fall back to geocoding when none are usable.
  const candidates = locatedBranches.length ? locatedBranches : branches;
  for (const branch of candidates) {
    const origin = locatedBranches.length
      ? { latitude: branch.latitude as number, longitude: branch.longitude as number }
      : await branchPoint(branch);
    if (!origin) continue;
    const distance = distanceKm(origin, destination);
    if (!nearest || distance < nearest.distanceKm) nearest = { branch, distanceKm: distance };
  }

  if (!nearest) return { serviceable: false, reason: "NO_BRANCH" };
  const roundedDistance = Math.round(nearest.distanceKm * 10) / 10;
  if (nearest.distanceKm > radiusKm) {
    return { serviceable: false, reason: "OUT_OF_RANGE", nearestDistanceKm: roundedDistance };
  }
  return {
    serviceable: true,
    branchId: String(nearest.branch._id),
    branchName: nearest.branch.name,
    distanceKm: roundedDistance,
  };
}

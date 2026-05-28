export interface Box {
  id: number;
  title: string;
  address: string;
  neighbourhood: Neighbourhood;
  artist: string;
  year: number | "UNKNOWN";
  captured: string;
  description?: string; // short artwork description shown in the detail panel
  images?: string[]; // uploaded image paths (any orientation); the gallery only shows boxes that have at least one
  lat?: number;
  lng?: number;
}

// Neighbourhood names are free-form strings: the built-in set below ships with
// stamp graphics, and admins can add more at runtime (text-only, no stamp).
export type Neighbourhood = string;

// Display helper: "TRINITY BELLWOODS" -> "Trinity Bellwoods", "CHURCH-WELLESLEY" -> "Church-Wellesley".
// Storage stays as-is so existing data needs no migration; only the rendered form changes.
export function formatNeighbourhood(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// Display helper for Box.year: numeric years pass through; "UNKNOWN" becomes "Unknown".
export function formatYear(value: number | "UNKNOWN"): string {
  return value === "UNKNOWN" ? "Unknown" : String(value);
}

// Display helper for Box.address: every box is in Toronto, so the city/province
// tail is noise. Trim trailing ", Toronto, Ontario(, Canada)?" — case-insensitive.
// Storage stays as-is; only the rendered form changes.
export function formatAddress(value: string): string {
  return value.replace(/,\s*Toronto(,\s*Ontario)?(,\s*Canada)?\s*$/i, "").trim();
}

export const NEIGHBOURHOODS: Neighbourhood[] = [
  "LESLIEVILLE",
  "PARKDALE",
  "KENSINGTON",
  "TRINITY BELLWOODS",
  "RIVERSIDE",
  "CORK TOWN",
  "THE ANNEX",
];

export const boxes: Box[] = [
  {
    id: 1,
    title: "PIANO MAN",
    address: "1220 Queen Street East",
    neighbourhood: "LESLIEVILLE",
    artist: "Marcus Webb",
    year: 2021,
    captured: "3/14/26",
    description:
      "A weathered upright piano rendered in muted greys, keys spilling into the street like sheet music caught in the wind — a nod to the buskers who once worked this corner.",
    lat: 43.6634, lng: -79.3398,
  },
  {
    id: 2,
    title: "BLOOMING GARDEN",
    address: "544 Parliament St",
    neighbourhood: "CORK TOWN",
    artist: "Yuki Tanaka",
    year: 2022,
    captured: "4/2/26",
    description:
      "Hand-painted peonies and wild ferns wrap the box in overlapping layers, the palette shifting from dawn pink to deep dusk as you walk around it.",
    lat: 43.6601, lng: -79.3676,
  },
  {
    id: 3,
    title: "WIRED CITY",
    address: "390 Dufferin Street",
    neighbourhood: "TRINITY BELLWOODS",
    artist: "Jae-won Oh",
    year: 2022,
    captured: "11/3/26",
    lat: 43.6442, lng: -79.4244,
  },
  {
    id: 4,
    title: "PASSAGE",
    address: "78 Ossington Ave",
    neighbourhood: "RIVERSIDE",
    artist: "Tomás Rivera",
    year: 2020,
    captured: "1/19/26",
    lat: 43.6467, lng: -79.4204,
  },
  {
    id: 5,
    title: "ROOTS",
    address: "200 Gerrard Street E",
    neighbourhood: "PARKDALE",
    artist: "Amara Diallo",
    year: 2021,
    captured: "2/7/26",
    lat: 43.6622, lng: -79.3732,
  },
  {
    id: 6,
    title: "NIGHT FREQUENCY",
    address: "1 Bloor Street West",
    neighbourhood: "LESLIEVILLE",
    artist: "Priya Sharma",
    year: 2023,
    captured: "5/11/26",
    lat: 43.6700, lng: -79.3871,
  },
  {
    id: 7,
    title: "MERIDIAN",
    address: "King St W & Jameson Ave",
    neighbourhood: "PARKDALE",
    artist: "Lena Novak",
    year: 2022,
    captured: "6/3/26",
    lat: 43.6389, lng: -79.4279,
  },
  {
    id: 8,
    title: "FLORA",
    address: "Kensington Ave & Nassau St",
    neighbourhood: "KENSINGTON",
    artist: "James Wu",
    year: 2020,
    captured: "7/22/26",
    lat: 43.6543, lng: -79.4005,
  },
  {
    id: 9,
    title: "VESSEL",
    address: "Augusta Ave & Baldwin St",
    neighbourhood: "KENSINGTON",
    artist: "Sofia Andersen",
    year: 2023,
    captured: "8/15/26",
    lat: 43.6549, lng: -79.4021,
  },
  {
    id: 10,
    title: "CURRENT",
    address: "Queen St E & Broadview Ave",
    neighbourhood: "RIVERSIDE",
    artist: "Nia Thompson",
    year: 2023,
    captured: "9/4/26",
    lat: 43.6618, lng: -79.3531,
  },
  {
    id: 11,
    title: "STRATA",
    address: "King St E & Parliament St",
    neighbourhood: "CORK TOWN",
    artist: "Kenji Mori",
    year: 2022,
    captured: "10/30/26",
    lat: 43.6516, lng: -79.3672,
  },
  {
    id: 12,
    title: "CANOPY",
    address: "Bloor St W & Spadina Ave",
    neighbourhood: "THE ANNEX",
    artist: "Eli Goldberg",
    year: 2021,
    captured: "12/1/26",
    lat: 43.6657, lng: -79.4022,
  },
];

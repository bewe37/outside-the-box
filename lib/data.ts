export interface Box {
  id: number;
  title: string;
  address: string;
  neighbourhood: Neighbourhood;
  artist: string;
  year: number;
  captured: string;
}

export type Neighbourhood =
  | "LESLIEVILLE"
  | "PARKDALE"
  | "KENSINGTON"
  | "TRINITY BELLWOODS"
  | "RIVERSIDE"
  | "CORK TOWN"
  | "THE ANNEX";

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
  },
  {
    id: 2,
    title: "BLOOMING GARDEN",
    address: "544 Parliament St",
    neighbourhood: "CORK TOWN",
    artist: "Yuki Tanaka",
    year: 2022,
    captured: "4/2/26",
  },
  {
    id: 3,
    title: "WIRED CITY",
    address: "390 Dufferin Street",
    neighbourhood: "TRINITY BELLWOODS",
    artist: "Jae-won Oh",
    year: 2022,
    captured: "11/3/26",
  },
  {
    id: 4,
    title: "PASSAGE",
    address: "78 Ossington Ave",
    neighbourhood: "RIVERSIDE",
    artist: "Tomás Rivera",
    year: 2020,
    captured: "1/19/26",
  },
  {
    id: 5,
    title: "ROOTS",
    address: "200 Gerrard Street E",
    neighbourhood: "PARKDALE",
    artist: "Amara Diallo",
    year: 2021,
    captured: "2/7/26",
  },
  {
    id: 6,
    title: "NIGHT FREQUENCY",
    address: "1 Bloor Street West",
    neighbourhood: "LESLIEVILLE",
    artist: "Priya Sharma",
    year: 2023,
    captured: "5/11/26",
  },
  {
    id: 7,
    title: "MERIDIAN",
    address: "King St W & Jameson Ave",
    neighbourhood: "PARKDALE",
    artist: "Lena Novak",
    year: 2022,
    captured: "6/3/26",
  },
  {
    id: 8,
    title: "FLORA",
    address: "Kensington Ave & Nassau St",
    neighbourhood: "KENSINGTON",
    artist: "James Wu",
    year: 2020,
    captured: "7/22/26",
  },
  {
    id: 9,
    title: "VESSEL",
    address: "Augusta Ave & Baldwin St",
    neighbourhood: "KENSINGTON",
    artist: "Sofia Andersen",
    year: 2023,
    captured: "8/15/26",
  },
  {
    id: 10,
    title: "CURRENT",
    address: "Queen St E & Broadview Ave",
    neighbourhood: "RIVERSIDE",
    artist: "Nia Thompson",
    year: 2023,
    captured: "9/4/26",
  },
  {
    id: 11,
    title: "STRATA",
    address: "King St E & Parliament St",
    neighbourhood: "CORK TOWN",
    artist: "Kenji Mori",
    year: 2022,
    captured: "10/30/26",
  },
  {
    id: 12,
    title: "CANOPY",
    address: "Bloor St W & Spadina Ave",
    neighbourhood: "THE ANNEX",
    artist: "Eli Goldberg",
    year: 2021,
    captured: "12/1/26",
  },
];

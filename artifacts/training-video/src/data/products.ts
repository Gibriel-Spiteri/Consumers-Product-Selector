// Curated subset of real product data for the training video.
// SKUs match files in /public/products/<sku-with-safe-chars>.jpg

export type Product = {
  sku: string;
  name: string;
  brand?: string;
  image: string;
  price: number;
  retailPrice?: number;
  pprName?: string;
  pprReduction?: number;
  description?: string;
  location?: string;
};

const img = (sku: string) =>
  `${import.meta.env.BASE_URL}products/${sku.replace(/[^A-Za-z0-9._-]/g, "_")}.jpg`;

export const expressBath: Product[] = [
  { sku: "L-2410.01",        name: "St. Thomas Lavatory 24\"",          brand: "Icera",            image: img("L-2410.01"),         price: 94.54,  description: "Vitreous china wall-hung lavatory. 24 inch. White. Single faucet hole." },
  { sku: "QZ25224CBR",       name: "Foremost 25\" Quartz Vanity",       brand: "Foremost Bath",    image: img("QZ25224CBR"),        price: 455.49 },
  { sku: "ANCX-V3021FD-R-FBS-ADM", name: "Avance 30\" Vanity (R-Hand)", brand: "Avance Cabinetry", image: img("ANCX-V3021FD-R-FBS-ADM"), price: 430.48 },
  { sku: "QZ31224CBR",       name: "Foremost 31\" Quartz Vanity",       brand: "Foremost Bath",    image: img("QZ31224CBR"),        price: 489.00 },
  { sku: "L-2460.01",        name: "St. Thomas Console Lavatory",       brand: "Icera",            image: img("L-2460.01"),         price: 318.20 },
  { sku: "QZ49228CVR",       name: "Foremost 49\" Quartz Vanity Top",   brand: "Foremost Bath",    image: img("QZ49228CVR"),        price: 612.75 },
  { sku: "ANCB-V3621FD-R-FBS", name: "Avance 36\" Vanity",              brand: "Avance Cabinetry", image: img("ANCB-V3621FD-R-FBS"),price: 510.10 },
  { sku: "ANCB-V2421FB-FBS", name: "Avance 24\" Vanity",                brand: "Avance Cabinetry", image: img("ANCB-V2421FB-FBS"),  price: 388.62 },
];

export const ppr: Product[] = [
  { sku: "62.4020.102.60",   name: "Bathtub Waste & Overflow",    brand: "Neptune", image: img("62.4020.102.60"),  price: 99.99,  retailPrice: 189.99, pprName: "Neptune Bathtub Waste", pprReduction: 41.16 },
  { sku: "E15.21112.500030", name: "Neptune Drop-In Tub 60\"x32\"", brand: "Neptune", image: img("E15.21112.500030"),price: 999.99, retailPrice: 2299.99, pprName: "Neptune Tub", pprReduction: 648.41 },
  { sku: "E15.21512.550010", name: "Neptune Skirted Tub 66\"x32\"", brand: "Neptune", image: img("E15.21512.550010"),price: 999.99, retailPrice: 2299.99, pprName: "Neptune Tub", pprReduction: 648.41 },
];

export const dfs: Product[] = [
  { sku: "BMS-XSCTV30",      name: "Bertch Surface-Mount Cabinet 30\"", brand: "Bertch Bath",      image: img("BMS-XSCTV30"),       price: 448.54, location: "Mt. Pleasant" },
  { sku: "LCSTV3622D",       name: "Bertch 36\" Vanity Display",        brand: "Bertch Bath",      image: img("LCSTV3622D"),        price: 720.00, location: "Saginaw" },
  { sku: "CVSS4872-RN-SV",   name: "Costa Vanity Top 48\"",             brand: "Costa",            image: img("CVSS4872-RN-SV"),    price: 624.00, location: "Mt. Pleasant" },
  { sku: "ANCX-V4221FD-R-FBS-ADM", name: "Avance 42\" Vanity Display",  brand: "Avance Cabinetry", image: img("ANCX-V4221FD-R-FBS-ADM"), price: 575.20, location: "Bay City" },
  { sku: "VL-BR-BATH-0725",  name: "Bath Vignette Display 7-25",        brand: "Vignette",         image: img("VL-BR-BATH-0725"),   price: 1880.00, location: "Saginaw" },
  { sku: "CS-VIPT",          name: "VIPT Showroom Display",             brand: "Costa",            image: img("CS-VIPT"),           price: 1450.00, location: "Bay City" },
];

export const featured: Product = {
  sku: "QZ25224CBR",
  name: "Foremost 25\" Quartz Vanity Top",
  brand: "Foremost Bath",
  image: img("QZ25224CBR"),
  price: 455.49,
  retailPrice: 599.00,
  description:
    "Premium engineered quartz vanity top with integrated rectangular bowl. Pre-drilled for single-hole faucet. Includes mounting clips and matching backsplash. White finish with subtle veining.",
};

export const dfsLocations = ["All Locations", "Mt. Pleasant", "Saginaw", "Bay City"];

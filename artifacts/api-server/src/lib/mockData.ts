interface MockProduct {
  id: number;
  netsuiteId: string;
  name: string;
  sku: string;
  price: number;
  ourPrice?: number;
  categoryId: number;
  manufacturer?: string;
  features?: string[];
}

export const MOCK_CATEGORIES = [
  { id: 1, netsuiteId: "mock-1", name: "Bath", level: 1, parentId: null },
  { id: 2, netsuiteId: "mock-2", name: "Kitchen", level: 1, parentId: null },
  { id: 3, netsuiteId: "mock-3", name: "Plumbing", level: 1, parentId: null },
  { id: 4, netsuiteId: "mock-4", name: "Home", level: 1, parentId: null },
  { id: 5, netsuiteId: "mock-5", name: "Displays", level: 1, parentId: null },
  { id: 6, netsuiteId: "mock-6", name: "Clearance", level: 1, parentId: null },
  { id: 7, netsuiteId: "mock-7", name: "Internal", level: 1, parentId: null },

  { id: 10, netsuiteId: "mock-10", name: "Accessories", level: 2, parentId: 1 },
  { id: 11, netsuiteId: "mock-11", name: "Countertops", level: 2, parentId: 1 },
  { id: 12, netsuiteId: "mock-12", name: "Medicine Cabinets & Lights", level: 2, parentId: 1 },
  { id: 13, netsuiteId: "mock-13", name: "Tub & Shower Doors", level: 2, parentId: 1 },
  { id: 14, netsuiteId: "mock-14", name: "Vanities", level: 2, parentId: 1 },

  { id: 20, netsuiteId: "mock-20", name: "Cabinets", level: 2, parentId: 2 },
  { id: 21, netsuiteId: "mock-21", name: "Countertops", level: 2, parentId: 2 },
  { id: 22, netsuiteId: "mock-22", name: "Sinks", level: 2, parentId: 2 },
  { id: 23, netsuiteId: "mock-23", name: "Faucets", level: 2, parentId: 2 },

  { id: 30, netsuiteId: "mock-30", name: "Pipes & Fittings", level: 2, parentId: 3 },
  { id: 31, netsuiteId: "mock-31", name: "Valves", level: 2, parentId: 3 },
  { id: 32, netsuiteId: "mock-32", name: "Water Heaters", level: 2, parentId: 3 },

  { id: 100, netsuiteId: "mock-100", name: "Robe/Utility Hooks", level: 3, parentId: 10 },
  { id: 101, netsuiteId: "mock-101", name: "Soap Dish/Dispenser", level: 3, parentId: 10 },

  { id: 110, netsuiteId: "mock-110", name: "23\" to 28\" Wide", level: 3, parentId: 11 },
  { id: 111, netsuiteId: "mock-111", name: "29\" to 34\" Wide", level: 3, parentId: 11 },
  { id: 112, netsuiteId: "mock-112", name: "35\" to 40\" Wide", level: 3, parentId: 11 },
  { id: 113, netsuiteId: "mock-113", name: "47\" to 52\" Wide", level: 3, parentId: 11 },
  { id: 114, netsuiteId: "mock-114", name: "59\" to 64\" Wide", level: 3, parentId: 11 },

  { id: 120, netsuiteId: "mock-120", name: "23\" to 28\" Wide OA", level: 3, parentId: 12 },
  { id: 121, netsuiteId: "mock-121", name: "29\" to 34\" Wide OA", level: 3, parentId: 12 },
  { id: 122, netsuiteId: "mock-122", name: "35\" to 40\" Wide OA", level: 3, parentId: 12 },
  { id: 123, netsuiteId: "mock-123", name: "47\" to 52\" Wide OA", level: 3, parentId: 12 },
  { id: 124, netsuiteId: "mock-124", name: "53\" Wide OA and Over", level: 3, parentId: 12 },
  { id: 125, netsuiteId: "mock-125", name: "Accessories", level: 3, parentId: 12 },
  { id: 126, netsuiteId: "mock-126", name: "Side Light", level: 3, parentId: 12 },
  { id: 127, netsuiteId: "mock-127", name: "Top Light", level: 3, parentId: 12 },
  { id: 128, netsuiteId: "mock-128", name: "Wall Mirrors", level: 3, parentId: 12 },

  { id: 130, netsuiteId: "mock-130", name: "Shower Doors", level: 3, parentId: 13 },
  { id: 131, netsuiteId: "mock-131", name: "Tub Doors", level: 3, parentId: 13 },

  { id: 140, netsuiteId: "mock-140", name: "Matching Light", level: 3, parentId: 14 },
  { id: 141, netsuiteId: "mock-141", name: "Matching Medicine Cabinets", level: 3, parentId: 14 },
  { id: 142, netsuiteId: "mock-142", name: "Matching Wall Mirrors", level: 3, parentId: 14 },
  { id: 143, netsuiteId: "mock-143", name: "Vanities", level: 3, parentId: 14 },
  { id: 144, netsuiteId: "mock-144", name: "Wall Valets (Overjohns)", level: 3, parentId: 14 },

  { id: 200, netsuiteId: "mock-200", name: "Base Cabinets", level: 3, parentId: 20 },
  { id: 201, netsuiteId: "mock-201", name: "Wall Cabinets", level: 3, parentId: 20 },
  { id: 202, netsuiteId: "mock-202", name: "Tall Cabinets", level: 3, parentId: 20 },

  { id: 210, netsuiteId: "mock-210", name: "Granite", level: 3, parentId: 21 },
  { id: 211, netsuiteId: "mock-211", name: "Quartz", level: 3, parentId: 21 },
  { id: 212, netsuiteId: "mock-212", name: "Laminate", level: 3, parentId: 21 },
];

export const MOCK_PRODUCTS: MockProduct[] = [
  // Plumbing – Basic
  { id: 1, netsuiteId: "prod-1", name: "1/2\" Copper Pipe 5ft", sku: "PP-COP-5-05", price: 12.99, ourPrice: 10.99, categoryId: 30, manufacturer: "Mueller Industries" },
  { id: 2, netsuiteId: "prod-2", name: "3/4\" PVC Pipe 10ft", sku: "PP-PVC-10-075", price: 8.49, ourPrice: 6.99, categoryId: 30, manufacturer: "Charlotte Pipe" },
  { id: 3, netsuiteId: "prod-3", name: "ABS Pipe 1.5\" x 10ft", sku: "PP-ABS-15-10", price: 11.99, ourPrice: 9.99, categoryId: 30, manufacturer: "Charlotte Pipe" },
  { id: 4, netsuiteId: "prod-4", name: "Shut-Off Valve 1/2\"", sku: "VLV-SO-050", price: 7.99, ourPrice: 6.49, categoryId: 31, manufacturer: "Watts Water" },
  { id: 5, netsuiteId: "prod-5", name: "Pressure Relief Valve", sku: "VLV-PR-075", price: 22.99, ourPrice: 18.99, categoryId: 31, manufacturer: "Watts Water" },
  { id: 6, netsuiteId: "prod-6", name: "Tankless Gas Water Heater", sku: "WH-TKG-001", price: 899.99, ourPrice: 749.99, categoryId: 32, manufacturer: "Rinnai" },
  { id: 7, netsuiteId: "prod-7", name: "30-Gallon Electric Water Heater", sku: "WH-ELC-030", price: 499.99, ourPrice: 429.99, categoryId: 32, manufacturer: "A.O. Smith" },
  { id: 8, netsuiteId: "prod-8", name: "34\" Cultured Marble Top", sku: "CT-CM-034", price: 199.99, ourPrice: 169.99, categoryId: 111, manufacturer: "American Bath Factory" },
  { id: 9, netsuiteId: "prod-9", name: "36\" Granite Countertop", sku: "CT-GRN-036", price: 449.99, ourPrice: 379.99, categoryId: 112, manufacturer: "MSI Surfaces" },
  { id: 10, netsuiteId: "prod-10", name: "52\" Double Sink Top", sku: "CT-DS-052", price: 399.99, ourPrice: 339.99, categoryId: 113, manufacturer: "American Bath Factory" },
  { id: 11, netsuiteId: "prod-11", name: "60\" Cultured Marble Top", sku: "CT-CM-060", price: 349.99, ourPrice: 299.99, categoryId: 114, manufacturer: "American Bath Factory" },

  { id: 12, netsuiteId: "prod-12", name: "24\" Medicine Cabinet", sku: "MC-024-CHR", price: 189.99, ourPrice: 159.99, categoryId: 120, manufacturer: "Kohler" },
  { id: 13, netsuiteId: "prod-13", name: "30\" Recessed Medicine Cabinet", sku: "MC-030-REC", price: 249.99, ourPrice: 209.99, categoryId: 121, manufacturer: "Robern" },
  { id: 14, netsuiteId: "prod-14", name: "36\" Surface Mount Cabinet", sku: "MC-036-SRF", price: 279.99, ourPrice: 239.99, categoryId: 122, manufacturer: "Robern" },

  { id: 15, netsuiteId: "prod-15", name: "36\" Frameless Shower Door", sku: "SD-FRM-036", price: 399.99, ourPrice: 339.99, categoryId: 130, manufacturer: "Delta" },
  { id: 16, netsuiteId: "prod-16", name: "48\" Pivot Shower Door", sku: "SD-PIV-048", price: 499.99, ourPrice: 429.99, categoryId: 130, manufacturer: "Delta" },
  { id: 17, netsuiteId: "prod-17", name: "60\" Tub Enclosure", sku: "TE-060-CHR", price: 549.99, ourPrice: 469.99, categoryId: 131, manufacturer: "Dreamline" },

  { id: 18, netsuiteId: "prod-18", name: "24\" Vanity with Sink", sku: "VAN-024-WH", price: 399.99, ourPrice: 339.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },
  { id: 19, netsuiteId: "prod-19", name: "36\" Espresso Vanity", sku: "VAN-036-ESP", price: 549.99, ourPrice: 469.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },
  { id: 20, netsuiteId: "prod-20", name: "48\" Gray Vanity", sku: "VAN-048-GRY", price: 699.99, ourPrice: 599.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },
  { id: 21, netsuiteId: "prod-21", name: "60\" Double Vanity", sku: "VAN-060-DBL", price: 999.99, ourPrice: 849.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },

  // Bath – Accessories
  { id: 26, netsuiteId: "prod-26", name: "Matte Black Robe Hook", sku: "RH-MBK-004", price: 27.99, ourPrice: 22.99, categoryId: 100, manufacturer: "Moen" },
  { id: 27, netsuiteId: "prod-27", name: "Double Robe Hook Chrome", sku: "RH-DBL-005", price: 39.99, ourPrice: 33.99, categoryId: 100, manufacturer: "Moen" },
  { id: 28, netsuiteId: "prod-28", name: "Towel Ring Brushed Nickel", sku: "TR-BN-001", price: 21.99, ourPrice: 17.99, categoryId: 100, manufacturer: "Moen" },
  { id: 29, netsuiteId: "prod-29", name: "Wall-Mount Soap Dispenser Chrome", sku: "SD-WM-003", price: 31.99, ourPrice: 26.99, categoryId: 101, manufacturer: "Delta" },
  { id: 30, netsuiteId: "prod-30", name: "Recessed Soap Dish Ceramic White", sku: "SD-REC-004", price: 14.99, ourPrice: 11.99, categoryId: 101, manufacturer: "American Standard" },

  // Bath – Countertops
  { id: 31, netsuiteId: "prod-31", name: "28\" Quartz Vanity Top White", sku: "CT-QTZ-028", price: 259.99, ourPrice: 219.99, categoryId: 110, manufacturer: "MSI Surfaces" },
  { id: 32, netsuiteId: "prod-32", name: "34\" Solid Surface Top", sku: "CT-SS-034", price: 229.99, ourPrice: 195.99, categoryId: 111, manufacturer: "Corian" },
  { id: 33, netsuiteId: "prod-33", name: "34\" Porcelain Vanity Top", sku: "CT-PRC-034", price: 179.99, ourPrice: 152.99, categoryId: 111, manufacturer: "American Standard" },
  { id: 34, netsuiteId: "prod-34", name: "40\" Marble Vanity Top", sku: "CT-MAR-040", price: 419.99, ourPrice: 355.99, categoryId: 112, manufacturer: "MSI Surfaces" },
  { id: 35, netsuiteId: "prod-35", name: "52\" Quartz Double Sink Top", sku: "CT-QTZ-052", price: 549.99, ourPrice: 469.99, categoryId: 113, manufacturer: "Silestone" },
  { id: 36, netsuiteId: "prod-36", name: "64\" Cultured Marble Top", sku: "CT-CM-064", price: 489.99, ourPrice: 415.99, categoryId: 114, manufacturer: "American Bath Factory" },

  // Bath – Medicine Cabinets & Lights (category 121 — 12 custom products)
  { id: 37, netsuiteId: "prod-37", name: "24\" Mirrored Medicine Cabinet", sku: "MC-MIR-024", price: 159.99, ourPrice: 134.99, categoryId: 120, manufacturer: "Kohler" },
  { id: 38, netsuiteId: "prod-38", name: "28\" LED Medicine Cabinet", sku: "MC-LED-028", price: 299.99, ourPrice: 254.99, categoryId: 120, manufacturer: "Robern" },
  {
    id: 39, netsuiteId: "prod-39", name: "30\" Frameless Recessed Cabinet", sku: "MC-FRM-030", price: 219.99, ourPrice: 184.99, categoryId: 121,
    manufacturer: "Robern",
    features: [
      "Frameless full-overlay door for a sleek, modern appearance",
      "Recessed installation — fits between standard 16\" on-center wall studs",
      "Concealed full-length piano hinge with 165° opening",
      "Adjustable interior glass shelves",
      "Mirrored interior for enhanced visibility",
      "Polished mirror exterior; beveled edges optional",
      "Overall size: 30\" W × 26\" H × 3.5\" D",
    ],
  },
  {
    id: 40, netsuiteId: "prod-40", name: "34\" Tri-View Cabinet", sku: "MC-TRI-034", price: 349.99, ourPrice: 294.99, categoryId: 121,
    manufacturer: "Robern",
    features: [
      "Three-door tri-view design for panoramic visibility",
      "Frameless construction with polished mirror finish",
      "Six adjustable glass shelves across three compartments",
      "Soft-close hinges on all three doors",
      "Recessed or surface-mount installation",
      "Overall size: 34\" W × 28\" H × 3.75\" D",
    ],
  },
  {
    id: 89, netsuiteId: "prod-89", name: "Camden Cotton 36x21 Two Door Two Drawers On Right Vanity Cabinet", sku: "MC-SD-030-CHR", price: 189.99, ourPrice: 159.99, categoryId: 121,
    manufacturer: "Kohler",
    features: [
      "Single-door surface-mount design — no wall opening required",
      "Chrome-finish aluminum frame for a polished look",
      "Three adjustable interior shelves",
      "Reversible door for left or right opening",
      "Overall size: 30\" W × 26\" H × 4.5\" D",
    ],
  },
  {
    id: 90, netsuiteId: "prod-90", name: "30\" Recessed Soft-Close Cabinet", sku: "MC-SC-030-REC", price: 259.99, ourPrice: 219.99, categoryId: 121,
    manufacturer: "Strasser Woodenworks",
    features: [
      "Soft-close integrated hinge — door glides shut silently",
      "Recessed installation between standard studs",
      "Four adjustable glass shelves",
      "Full-length piano hinge with 170° swing",
      "Frameless mirrored front",
      "Overall size: 30\" W × 27\" H × 4\" D",
    ],
  },
  {
    id: 91, netsuiteId: "prod-91", name: "30\" LED Lighted Medicine Cabinet", sku: "MC-LED-030", price: 379.99, ourPrice: 319.99, categoryId: 121,
    manufacturer: "Robern",
    features: [
      "Integrated LED lighting strip provides bright, even illumination",
      "Touch-activated dimmer switch on door frame",
      "Defogger pad prevents mirror condensation",
      "CRI 90+ LED — true color rendering",
      "Three adjustable glass shelves",
      "Surface or recessed mount capable",
      "Overall size: 30\" W × 30\" H × 4.75\" D",
    ],
  },
  {
    id: 92, netsuiteId: "prod-92", name: "34\" Beveled Mirror Cabinet", sku: "MC-BEV-034", price: 299.99, ourPrice: 254.99, categoryId: 121,
    manufacturer: "Kohler",
    features: [
      "Elegant 1\" beveled mirror edge on door",
      "Single-door frameless design",
      "Recessed installation",
      "Three adjustable interior shelves",
      "Reversible hinge for flexible installation",
      "Overall size: 34\" W × 26\" H × 3.5\" D",
    ],
  },
  {
    id: 93, netsuiteId: "prod-93", name: "34\" Aluminum Frame Cabinet", sku: "MC-ALU-034", price: 239.99, ourPrice: 203.99, categoryId: 121,
    manufacturer: "American Standard",
    features: [
      "Slim aluminum frame with anodized finish",
      "Single-door surface-mount",
      "Four adjustable shelves",
      "Reversible door swing",
      "Lightweight yet durable aluminum construction",
      "Overall size: 34\" W × 26\" H × 4\" D",
    ],
  },
  {
    id: 94, netsuiteId: "prod-94", name: "34\" Recessed Bi-View Cabinet", sku: "MC-BIV-034-REC", price: 319.99, ourPrice: 271.99, categoryId: 121,
    manufacturer: "Robern",
    features: [
      "Two-door bi-view mirrored cabinet",
      "Recessed installation between studs",
      "Four adjustable glass shelves",
      "Dual soft-close hinges",
      "Center-open or offset-open configurations",
      "Overall size: 34\" W × 28\" H × 3.75\" D",
    ],
  },
  {
    id: 95, netsuiteId: "prod-95", name: "30\" Oil Rubbed Bronze Cabinet", sku: "MC-ORB-030", price: 269.99, ourPrice: 228.99, categoryId: 121,
    manufacturer: "Delta",
    features: [
      "Rich oil-rubbed bronze finish frame",
      "Single-door surface-mount",
      "Three adjustable shelves",
      "Coordinates with Delta bath collections in ORB finish",
      "Overall size: 30\" W × 26\" H × 4.5\" D",
    ],
  },
  {
    id: 96, netsuiteId: "prod-96", name: "34\" Matte Black Cabinet", sku: "MC-MBK-034", price: 329.99, ourPrice: 279.99, categoryId: 121,
    manufacturer: "Moen",
    features: [
      "Bold matte black frame for a contemporary statement",
      "Single-door surface-mount",
      "Soft-close hinge",
      "Four adjustable shelves",
      "Pairs with Moen matte black bath collections",
      "Overall size: 34\" W × 28\" H × 4.5\" D",
    ],
  },
  {
    id: 97, netsuiteId: "prod-97", name: "30\" Fog-Free Mirror Cabinet", sku: "MC-FF-030", price: 289.99, ourPrice: 245.99, categoryId: 121,
    manufacturer: "Robern",
    features: [
      "Integrated heating element keeps mirror fog-free",
      "Single-door recessed design",
      "120V hardwired defogger — no condensation after showers",
      "Three adjustable glass shelves",
      "Frameless polished mirror",
      "Overall size: 30\" W × 26\" H × 3.5\" D",
    ],
  },
  {
    id: 98, netsuiteId: "prod-98", name: "34\" Smart LED Touch Cabinet", sku: "MC-SML-034", price: 449.99, ourPrice: 381.99, categoryId: 121,
    manufacturer: "Robern",
    features: [
      "Full-length LED backlit mirror with touch-dimmer control",
      "Built-in Bluetooth speaker",
      "USB-A and USB-C charging ports inside cabinet",
      "Anti-fog heating pad",
      "Four adjustable glass shelves",
      "Recessed or surface-mount installation",
      "Overall size: 34\" W × 30\" H × 5\" D",
    ],
  },

  { id: 41, netsuiteId: "prod-41", name: "36\" Recessed Aluminum Cabinet", sku: "MC-ALU-036", price: 289.99, ourPrice: 245.99, categoryId: 122, manufacturer: "American Standard" },
  { id: 42, netsuiteId: "prod-42", name: "48\" Frameless Surface Mount", sku: "MC-FRM-048", price: 399.99, ourPrice: 339.99, categoryId: 123, manufacturer: "Robern" },
  { id: 43, netsuiteId: "prod-43", name: "60\" Wide Double Door Cabinet", sku: "MC-DBL-060", price: 529.99, ourPrice: 449.99, categoryId: 124, manufacturer: "Robern" },
  { id: 44, netsuiteId: "prod-44", name: "Vanity Light Bar 3-Light Chrome", sku: "LB-3L-CHR", price: 89.99, ourPrice: 74.99, categoryId: 126, manufacturer: "Progress Lighting" },
  { id: 45, netsuiteId: "prod-45", name: "Vanity Light Bar 5-Light Nickel", sku: "LB-5L-NKL", price: 119.99, ourPrice: 99.99, categoryId: 126, manufacturer: "Progress Lighting" },
  { id: 46, netsuiteId: "prod-46", name: "Single Top Light Chrome", sku: "TL-SGL-CHR", price: 74.99, ourPrice: 62.99, categoryId: 127, manufacturer: "Progress Lighting" },
  { id: 47, netsuiteId: "prod-47", name: "30\" Frameless Wall Mirror", sku: "WM-FRM-030", price: 79.99, ourPrice: 67.99, categoryId: 128, manufacturer: "Kohler" },
  { id: 48, netsuiteId: "prod-48", name: "36\" Beveled Wall Mirror", sku: "WM-BEV-036", price: 99.99, ourPrice: 84.99, categoryId: 128, manufacturer: "Kohler" },
  { id: 49, netsuiteId: "prod-49", name: "48\" LED Backlit Mirror", sku: "WM-LED-048", price: 249.99, ourPrice: 212.99, categoryId: 128, manufacturer: "Robern" },

  // Bath – Tub & Shower Doors
  { id: 50, netsuiteId: "prod-50", name: "36\" Chrome Bypass Shower Door", sku: "SD-BYP-036", price: 349.99, ourPrice: 299.99, categoryId: 130, manufacturer: "Dreamline" },
  { id: 51, netsuiteId: "prod-51", name: "48\" Neo-Angle Shower Door", sku: "SD-NEO-048", price: 599.99, ourPrice: 509.99, categoryId: 130, manufacturer: "Dreamline" },
  { id: 52, netsuiteId: "prod-52", name: "60\" Sliding Shower Door Nickel", sku: "SD-SLD-060", price: 649.99, ourPrice: 552.99, categoryId: 130, manufacturer: "Delta" },
  { id: 53, netsuiteId: "prod-53", name: "60\" Bi-Fold Tub Door Chrome", sku: "TD-BFD-060", price: 399.99, ourPrice: 339.99, categoryId: 131, manufacturer: "Dreamline" },
  { id: 54, netsuiteId: "prod-54", name: "60\" Sliding Tub Door Oil Rubbed", sku: "TD-SLD-060", price: 449.99, ourPrice: 382.99, categoryId: 131, manufacturer: "Delta" },

  // Bath – Vanities
  { id: 55, netsuiteId: "prod-55", name: "24\" White Shaker Vanity", sku: "VAN-024-SHK", price: 329.99, ourPrice: 279.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },
  { id: 56, netsuiteId: "prod-56", name: "30\" Navy Blue Vanity", sku: "VAN-030-NVY", price: 449.99, ourPrice: 382.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },
  { id: 57, netsuiteId: "prod-57", name: "36\" Walnut Vanity", sku: "VAN-036-WLN", price: 599.99, ourPrice: 509.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },
  { id: 58, netsuiteId: "prod-58", name: "48\" Freestanding Vanity White", sku: "VAN-048-FSW", price: 749.99, ourPrice: 637.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },
  { id: 59, netsuiteId: "prod-59", name: "72\" Double Vanity Gray", sku: "VAN-072-GRY", price: 1299.99, ourPrice: 1104.99, categoryId: 143, manufacturer: "Strasser Woodenworks" },
  { id: 60, netsuiteId: "prod-60", name: "Vanity Light Matching Kit Chrome", sku: "VLK-CHR-001", price: 89.99, ourPrice: 76.99, categoryId: 140, manufacturer: "Progress Lighting" },
  { id: 61, netsuiteId: "prod-61", name: "Matching Oval Mirror 30\"", sku: "VWM-OVL-030", price: 109.99, ourPrice: 93.99, categoryId: 142, manufacturer: "Kohler" },

  // Kitchen – Cabinets
  { id: 62, netsuiteId: "prod-62", name: "12\" Base Cabinet White", sku: "BC-WHT-012", price: 119.99, ourPrice: 101.99, categoryId: 200, manufacturer: "Fabuwood" },
  { id: 63, netsuiteId: "prod-63", name: "24\" Base Cabinet Gray", sku: "BC-GRY-024", price: 189.99, ourPrice: 161.99, categoryId: 200, manufacturer: "Fabuwood" },
  { id: 64, netsuiteId: "prod-64", name: "36\" Base Cabinet Espresso", sku: "BC-ESP-036", price: 249.99, ourPrice: 212.99, categoryId: 200, manufacturer: "Fabuwood" },
  { id: 65, netsuiteId: "prod-65", name: "12\" Wall Cabinet White", sku: "WC-WHT-012", price: 89.99, ourPrice: 76.99, categoryId: 201, manufacturer: "Fabuwood" },
  { id: 66, netsuiteId: "prod-66", name: "24\" Wall Cabinet Gray", sku: "WC-GRY-024", price: 129.99, ourPrice: 110.99, categoryId: 201, manufacturer: "Fabuwood" },
  { id: 67, netsuiteId: "prod-67", name: "36\" Wall Cabinet Espresso", sku: "WC-ESP-036", price: 179.99, ourPrice: 152.99, categoryId: 201, manufacturer: "Fabuwood" },
  { id: 68, netsuiteId: "prod-68", name: "84\" Pantry Tall Cabinet", sku: "TC-PAN-084", price: 399.99, ourPrice: 339.99, categoryId: 202, manufacturer: "Fabuwood" },
  { id: 69, netsuiteId: "prod-69", name: "90\" Utility Tall Cabinet White", sku: "TC-UTL-090", price: 449.99, ourPrice: 382.99, categoryId: 202, manufacturer: "Fabuwood" },

  // Kitchen – Countertops
  { id: 70, netsuiteId: "prod-70", name: "Granite Slab 96\" x 26\"", sku: "KC-GRN-096", price: 899.99, ourPrice: 764.99, categoryId: 210, manufacturer: "MSI Surfaces" },
  { id: 71, netsuiteId: "prod-71", name: "Butcher Block 96\" x 25\"", sku: "KC-BB-096", price: 349.99, ourPrice: 297.99, categoryId: 210, manufacturer: "Hardwood Reflections" },
  { id: 72, netsuiteId: "prod-72", name: "Calacatta Quartz 108\" x 26\"", sku: "KC-QTZ-108", price: 1199.99, ourPrice: 1019.99, categoryId: 211, manufacturer: "Silestone" },
  { id: 73, netsuiteId: "prod-73", name: "White Quartz 96\" x 26\"", sku: "KC-QTZ-096", price: 999.99, ourPrice: 849.99, categoryId: 211, manufacturer: "Silestone" },
  { id: 74, netsuiteId: "prod-74", name: "Laminate Formica Sheet 96\"", sku: "KC-LAM-096", price: 149.99, ourPrice: 127.99, categoryId: 212, manufacturer: "Formica Group" },

  // Plumbing
  { id: 75, netsuiteId: "prod-75", name: "1\" Copper Pipe 10ft", sku: "PP-COP-10-10", price: 44.99, ourPrice: 37.99, categoryId: 300, manufacturer: "Mueller Industries" },
  { id: 76, netsuiteId: "prod-76", name: "PVC 90° Elbow 3/4\"", sku: "FIT-ELB-075", price: 2.49, ourPrice: 1.99, categoryId: 302, manufacturer: "Charlotte Pipe" },
  { id: 77, netsuiteId: "prod-77", name: "PVC Tee 1\"", sku: "FIT-TEE-100", price: 3.99, ourPrice: 3.29, categoryId: 302, manufacturer: "Charlotte Pipe" },
  { id: 78, netsuiteId: "prod-78", name: "Ball Valve 1/2\" Chrome", sku: "VLV-BLL-050", price: 14.99, ourPrice: 12.49, categoryId: 31, manufacturer: "Watts Water" },
  { id: 79, netsuiteId: "prod-79", name: "Gate Valve 3/4\"", sku: "VLV-GAT-075", price: 18.99, ourPrice: 15.99, categoryId: 31, manufacturer: "Watts Water" },
  { id: 80, netsuiteId: "prod-80", name: "40-Gallon Electric Water Heater", sku: "WH-ELC-040", price: 599.99, ourPrice: 509.99, categoryId: 32, manufacturer: "A.O. Smith" },
  { id: 81, netsuiteId: "prod-81", name: "50-Gallon Gas Water Heater", sku: "WH-GAS-050", price: 799.99, ourPrice: 679.99, categoryId: 32, manufacturer: "Rheem" },
  { id: 82, netsuiteId: "prod-82", name: "Tankless Electric Water Heater", sku: "WH-TNK-ELC", price: 499.99, ourPrice: 424.99, categoryId: 32, manufacturer: "Stiebel Eltron" },

  // Kitchen – Sinks & Faucets
  { id: 83, netsuiteId: "prod-83", name: "Single Bowl Stainless Sink 30\"", sku: "KS-SB-030", price: 179.99, ourPrice: 152.99, categoryId: 22, manufacturer: "Kraus" },
  { id: 84, netsuiteId: "prod-84", name: "Double Bowl Undermount Sink", sku: "KS-DB-UND", price: 299.99, ourPrice: 254.99, categoryId: 22, manufacturer: "Kraus" },
  { id: 85, netsuiteId: "prod-85", name: "Farmhouse Apron Sink White", sku: "KS-APR-WHT", price: 449.99, ourPrice: 382.99, categoryId: 22, manufacturer: "Kohler" },
  { id: 86, netsuiteId: "prod-86", name: "Pull-Down Kitchen Faucet Chrome", sku: "KF-PD-CHR", price: 189.99, ourPrice: 161.99, categoryId: 23, manufacturer: "Delta" },
  { id: 87, netsuiteId: "prod-87", name: "Pull-Out Faucet Brushed Nickel", sku: "KF-PO-BN", price: 159.99, ourPrice: 135.99, categoryId: 23, manufacturer: "Moen" },
  { id: 88, netsuiteId: "prod-88", name: "Bridge Faucet Oil Rubbed Bronze", sku: "KF-BR-ORB", price: 349.99, ourPrice: 297.99, categoryId: 23, manufacturer: "Kohler" },
];

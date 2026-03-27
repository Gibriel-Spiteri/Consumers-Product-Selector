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

  { id: 300, netsuiteId: "mock-300", name: "1/2\" Copper Pipe", level: 3, parentId: 30 },
  { id: 301, netsuiteId: "mock-301", name: "3/4\" Copper Pipe", level: 3, parentId: 30 },
  { id: 302, netsuiteId: "mock-302", name: "PVC Fittings", level: 3, parentId: 30 },
];

export const MOCK_PRODUCTS = [
  { id: 1, netsuiteId: "prod-1", name: "Chrome Robe Hook", sku: "RH-CHR-001", price: 24.99, categoryId: 100 },
  { id: 2, netsuiteId: "prod-2", name: "Brushed Nickel Robe Hook", sku: "RH-BN-002", price: 29.99, categoryId: 100 },
  { id: 3, netsuiteId: "prod-3", name: "Oil Rubbed Bronze Robe Hook", sku: "RH-ORB-003", price: 34.99, categoryId: 100 },
  { id: 4, netsuiteId: "prod-4", name: "Ceramic Soap Dish", sku: "SD-CER-001", price: 18.99, categoryId: 101 },
  { id: 5, netsuiteId: "prod-5", name: "Countertop Soap Dispenser", sku: "SD-DIS-002", price: 22.99, categoryId: 101 },

  { id: 6, netsuiteId: "prod-6", name: "28\" White Vanity Top", sku: "CT-WHT-028", price: 149.99, categoryId: 110 },
  { id: 7, netsuiteId: "prod-7", name: "28\" Marble Vanity Top", sku: "CT-MAR-028", price: 299.99, categoryId: 110 },
  { id: 8, netsuiteId: "prod-8", name: "34\" Cultured Marble Top", sku: "CT-CM-034", price: 199.99, categoryId: 111 },
  { id: 9, netsuiteId: "prod-9", name: "36\" Granite Countertop", sku: "CT-GRN-036", price: 449.99, categoryId: 112 },
  { id: 10, netsuiteId: "prod-10", name: "52\" Double Sink Top", sku: "CT-DS-052", price: 399.99, categoryId: 113 },
  { id: 11, netsuiteId: "prod-11", name: "60\" Cultured Marble Top", sku: "CT-CM-060", price: 349.99, categoryId: 114 },

  { id: 12, netsuiteId: "prod-12", name: "24\" Medicine Cabinet", sku: "MC-024-CHR", price: 189.99, categoryId: 120 },
  { id: 13, netsuiteId: "prod-13", name: "30\" Recessed Medicine Cabinet", sku: "MC-030-REC", price: 249.99, categoryId: 121 },
  { id: 14, netsuiteId: "prod-14", name: "36\" Surface Mount Cabinet", sku: "MC-036-SRF", price: 279.99, categoryId: 122 },

  { id: 15, netsuiteId: "prod-15", name: "36\" Frameless Shower Door", sku: "SD-FRM-036", price: 399.99, categoryId: 130 },
  { id: 16, netsuiteId: "prod-16", name: "48\" Pivot Shower Door", sku: "SD-PIV-048", price: 499.99, categoryId: 130 },
  { id: 17, netsuiteId: "prod-17", name: "60\" Tub Enclosure", sku: "TE-060-CHR", price: 549.99, categoryId: 131 },

  { id: 18, netsuiteId: "prod-18", name: "24\" Vanity with Sink", sku: "VAN-024-WH", price: 399.99, categoryId: 143 },
  { id: 19, netsuiteId: "prod-19", name: "36\" Espresso Vanity", sku: "VAN-036-ESP", price: 549.99, categoryId: 143 },
  { id: 20, netsuiteId: "prod-20", name: "48\" Gray Vanity", sku: "VAN-048-GRY", price: 699.99, categoryId: 143 },
  { id: 21, netsuiteId: "prod-21", name: "60\" Double Vanity", sku: "VAN-060-DBL", price: 999.99, categoryId: 143 },

  { id: 22, netsuiteId: "prod-22", name: "Granite Kitchen Countertop", sku: "KC-GRN-001", price: 599.99, categoryId: 210 },
  { id: 23, netsuiteId: "prod-23", name: "Quartz Kitchen Countertop", sku: "KC-QTZ-001", price: 799.99, categoryId: 211 },

  { id: 24, netsuiteId: "prod-24", name: "1/2\" Copper Pipe 10ft", sku: "PP-COP-05-10", price: 24.99, categoryId: 300 },
  { id: 25, netsuiteId: "prod-25", name: "3/4\" Copper Pipe 10ft", sku: "PP-COP-75-10", price: 32.99, categoryId: 301 },
];

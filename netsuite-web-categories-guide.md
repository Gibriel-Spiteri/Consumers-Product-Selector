# Building Custom Web Categories in NetSuite

This guide covers how to replace NetSuite's SiteBuilder category system with custom records, and how to connect them to the CPS application.

---

## Overview

The SiteBuilder integration provides tables we need to replace:

| SiteBuilder Table | Purpose | Custom Replacement | Status |
|---|---|---|---|
| `SiteCategory` | Category tree (name, parent, hierarchy) | `customrecord_cps_site_category` (CPS Site Category List) | Built |
| `ItemSiteCategory` | Links items to categories | `customrecord_cps_item_category` (CPS Item Category Prodline Matrix) | Built |
| `InventoryItemPresentationItem` | Related/cross-sell item relationships | TBD | Not yet started |

---

## Custom Record 1: CPS Site Category List

**Record Name:** CPS Site Category List
**Record ID:** `customrecord_cps_site_category`
**Internal ID:** 1141

This stores the category hierarchy (replaces `SiteCategory`).

### Fields

| Field ID | Label | Type | Notes |
|---|---|---|---|
| `name` (built-in) | Name | Text | Auto-generated full path (e.g., "Bath : Cabinetry : 23\" to 28\" Wide"). Written by the User Event script. Used as the display value in dropdowns so users see the full hierarchy. |
| `custrecord_cps_shortname` | Short Name | Free-Form Text | The leaf/display name entered by the user (e.g., "23\" to 28\" Wide"). This is what the app uses as the category display name. |
| `custrecord_cps_sub_category_of` | Sub-Category of | List/Record → `customrecord_cps_site_category` | Self-referencing parent pointer. Leave blank for top-level categories. |
| `custrecord_cps_category_level` | Category Level | Integer Number | Hierarchy depth (1 = root, 2 = second level, etc.). |
| `custrecord_cps_site` | Site | Free-Form Text | The site this category belongs to (e.g., "CPS"). |

### Configuration

- **Include Name Field:** Yes
- **Allow Attachments:** Yes
- **Show Notes:** Yes
- **Show Remove Link:** Yes
- **Allow Child Record Editing:** Yes
- **Access Type:** Require Custom Record Entries Permission

### Full Path Auto-Generation (User Event Script)

Deploy a **User Event Script** (Before Submit) on `customrecord_cps_site_category` to automatically build the `name` field from the short name plus the parent chain. This replicates the behavior of SiteBuilder's built-in `fullname` field and ensures the Site Category dropdown on the CPS Item Category Prodline Matrix record shows the full hierarchical path.

**Script Logic:**

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'], function (record, search) {

    function beforeSubmit(context) {
        var rec = context.newRecord;
        var shortName = rec.getValue({ fieldId: 'custrecord_cps_shortname' });
        var parentId = rec.getValue({ fieldId: 'custrecord_cps_sub_category_of' });

        var fullName = buildFullName(shortName, parentId);
        rec.setValue({ fieldId: 'name', value: fullName });
    }

    function buildFullName(shortName, parentId) {
        var parts = [shortName];

        while (parentId) {
            var parentLookup = search.lookupFields({
                type: 'customrecord_cps_site_category',
                id: parentId,
                columns: ['custrecord_cps_shortname', 'custrecord_cps_sub_category_of']
            });

            parts.unshift(parentLookup.custrecord_cps_shortname);

            var parentRefs = parentLookup.custrecord_cps_sub_category_of;
            parentId = (parentRefs && parentRefs.length > 0) ? parentRefs[0].value : null;
        }

        return parts.join(' : ');
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
```

**Deployment:**
- **Applied To:** `customrecord_cps_site_category`
- **Event Type:** Before Submit (Create & Edit)
- **Status:** Released

> **Important:** When renaming a parent category, you will also need to trigger an update on all child categories to regenerate their full names. This can be handled with a scheduled script or a Map/Reduce script that finds all descendants and re-saves them.

---

## Custom Record 2: CPS Item Category Prodline Matrix

**Record Name:** CPS Item Category Prodline Matrix
**Record ID:** `customrecord_cps_item_category`
**Internal ID:** 1142

This is the junction record linking items (or product lines) to site categories (replaces `ItemSiteCategory`).

### Fields

| Field ID | Label | Type | Notes |
|---|---|---|---|
| `custrecord_cps_product_line` | Product Line | List/Record → Product Line | The product line classification. If set **without** an Item, the record is reserved for future product-line-level functionality and is **ignored** by the app during sync. |
| `custrecord_cps_ic_item` | Item | List/Record → Item | The inventory item or kit item. **When this field has a value, the item is displayed in the Product Selector app.** |
| `custrecord_cps_ic_site` | Site | Free-Form Text | The site this assignment applies to (e.g., "CPS"). |
| `custrecord_cps_ic_category` | Site Category | List/Record → `customrecord_cps_site_category` | The CPS Site Category this item is assigned to. Dropdown displays the full hierarchical path from the `name` field. |
| `custrecord_cps_ic_preferred` | Preferred | Check Box | Marks the primary category for items assigned to multiple categories. The app uses this to determine the default category for breadcrumbs and navigation. |
| `custrecord_cps_ic_description` | Description | Free-Form Text | Optional notes for this category assignment. |

### Configuration

- **Include Name Field:** Yes
- **Allow Attachments:** Yes
- **Show Notes:** Yes
- **Show Remove Link:** Yes
- **Allow Child Record Editing:** Yes
- **Access Type:** Require Custom Record Entries Permission

### Sync Behavior

The app sync service should filter this record based on whether an Item is present:

| Scenario | App Behavior |
|---|---|
| **Item is set** (with or without Product Line) | Item is synced and displayed in the Product Selector under the assigned Site Category |
| **Only Product Line is set** (no Item) | Record is **skipped** during sync — reserved for future product-line-level features |

### Important Notes

- Each item should have **exactly one** record marked as "Preferred"
- An item can have multiple category assignments (appear in multiple categories), but the preferred flag determines where it shows up in breadcrumbs and primary navigation
- If no preferred is set, the app will fall back to the first category assignment found

---

## Custom Record 3: Web Related Item (Not Yet Built)

This record will store cross-sell and upsell relationships between products (replaces `InventoryItemPresentationItem`). To be defined in a future phase.

---

## Application-Side Query Changes

Once the custom records are in place, the following SuiteQL queries in the sync service need to be updated. These are all located in `artifacts/api-server/src/lib/netsuite.ts`.

### Categories Query

**Before (SiteBuilder):**
```sql
SELECT id, itemid, fullname, parentcategory, isonline
FROM SiteCategory
WHERE isinactive = 'F'
ORDER BY fullname
```

**After (CPS Site Category List):**
```sql
SELECT id,
       custrecord_cps_shortname AS itemid,
       name AS fullname,
       custrecord_cps_sub_category_of AS parentcategory,
       custrecord_cps_category_level AS level
FROM customrecord_cps_site_category
WHERE isinactive = 'F'
ORDER BY name
```

> **Note:** The CPS Site Category List does not have an `isonline` field like SiteBuilder did. Categories are considered online if they are active (not inactive). If online/offline control is needed in the future, a checkbox field can be added.

### Item-Category Join (in InventoryItem and KitItem queries)

**Before (SiteBuilder):**
```sql
LEFT JOIN ItemSiteCategory isc_def
  ON isc_def.item = item.id AND isc_def.isdefault = 'T'
LEFT JOIN (
  SELECT item, MIN(category) AS category
  FROM ItemSiteCategory GROUP BY item
) isc_any ON isc_any.item = item.id
```

**After (CPS Item Category Prodline Matrix):**
```sql
LEFT JOIN customrecord_cps_item_category cic_def
  ON cic_def.custrecord_cps_ic_item = item.id
  AND cic_def.custrecord_cps_ic_preferred = 'T'
  AND cic_def.isinactive = 'F'
LEFT JOIN (
  SELECT custrecord_cps_ic_item AS item, MIN(custrecord_cps_ic_category) AS category
  FROM customrecord_cps_item_category
  WHERE custrecord_cps_ic_item IS NOT NULL AND isinactive = 'F'
  GROUP BY custrecord_cps_ic_item
) cic_any ON cic_any.item = item.id
```

And update the SELECT clause:
```sql
COALESCE(cic_def.custrecord_cps_ic_category, cic_any.category) AS sitecategoryid
```

> **Key filter:** The `WHERE custrecord_cps_ic_item IS NOT NULL` clause ensures that product-line-only records (no item specified) are excluded from the sync. These records are reserved for future functionality.

### Related Items Query

Related items will continue using the existing SiteBuilder table (`InventoryItemPresentationItem`) until the replacement custom record is built:

```sql
SELECT superitem, presitemid, description, baseprice, onlineprice
FROM InventoryItemPresentationItem
```

---

## Migration Approach

To migrate existing SiteBuilder data into the new custom records:

1. **Categories:** Run a Map/Reduce script that queries `SiteCategory` and creates corresponding `customrecord_cps_site_category` records, preserving parent-child relationships. Migrate parents before children (topological sort).

2. **Item Assignments:** Run a Map/Reduce script that queries `ItemSiteCategory` and creates corresponding `customrecord_cps_item_category` records, mapping old SiteBuilder category IDs to the new CPS Site Category List IDs.

> **Tip:** Migrate in order — categories first (parents before children), then item assignments.

---

## Testing Checklist

After setting up the custom records and updating the queries:

- [ ] Create test categories with parent-child relationships
- [ ] Verify the `name` field auto-populates with the full path on save (e.g., "Bath : Cabinetry : 23\" to 28\" Wide")
- [ ] Verify the Site Category dropdown on the CPS Item Category Prodline Matrix shows the full path
- [ ] Assign items to categories with the "Preferred" flag
- [ ] Create a product-line-only record (no item) and confirm it is skipped during sync
- [ ] Run a sync in the app and verify categories appear correctly
- [ ] Verify items show under the correct categories
- [ ] Test renaming a parent category and re-saving children to update full names

---

## Summary

| Step | Where | What |
|---|---|---|
| 1 | NetSuite | Custom records are built (CPS Site Category List + CPS Item Category Prodline Matrix) |
| 2 | NetSuite | Deploy the User Event script for full name generation on CPS Site Category List |
| 3 | NetSuite | Migrate existing SiteBuilder data to the new records |
| 4 | Application | Update SuiteQL queries in `netsuite.ts` to point at the new custom records |
| 5 | Both | Test end-to-end sync and verify data integrity |
| 6 | Future | Build related items custom record to replace `InventoryItemPresentationItem` |
| 7 | Future | Implement product-line-level functionality for records without a specific item |

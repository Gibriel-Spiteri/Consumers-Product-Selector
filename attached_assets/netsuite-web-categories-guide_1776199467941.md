# Building Custom Web Categories in NetSuite

This guide covers how to replace NetSuite's SiteBuilder category system with custom records, and how to connect them to the CPS application.

---

## Overview

The SiteBuilder integration provides three tables we need to replace:

| SiteBuilder Table | Purpose | Custom Replacement |
|---|---|---|
| `SiteCategory` | Category tree (name, parent, hierarchy, online flag) | `customrecord_cps_site_category` |
| `ItemSiteCategory` | Links items to categories (many-to-many) | `customrecord_cps_item_category` |
| `InventoryItemPresentationItem` | Related/cross-sell item relationships | `customrecord_web_related_item` |

---

## Custom Record 1: CPS Site Category

**Record ID:** `customrecord_cps_site_category`

This stores the category hierarchy (replaces `SiteCategory`).

### Fields

| Field ID | Label | Type | Required | Notes |
|---|---|---|---|---|
| `name` (built-in) | Name | Text | Yes | Auto-generated full path (e.g., "Bath : Cabinetry : 23\" to 28\" Wide"). Written by the User Event script. |
| `custrecord_cps_shortname` | Short Name | Text | Yes | The leaf/display name entered by the user (e.g., "23\" to 28\" Wide"). |
| `custrecord_cps_sub_category_of` | Parent Category | List/Record (self-reference) | No | Points to the parent `customrecord_cps_site_category` record. Leave blank for top-level categories. |
| `custrecord_cps_site` | Site | List/Record → Site | No | The site this category belongs to (e.g., CPS). |
| `custrecord_cps_category_level` | Category Level | Integer | No | Hierarchy depth (1 = root). |

### Configuration

- **Record Name:** CPS Site Category
- **Include Name Field:** Yes
- **Allow Inline Editing:** Yes (recommended for easier management)
- **Show ID:** Yes (helpful for debugging)

### Full Path Auto-Generation (User Event Script)

Deploy a **User Event Script** (Before Submit) on `customrecord_cps_site_category` to automatically build the `name` field from the short name plus the parent chain. This replicates the behavior of SiteBuilder's built-in `fullname` field and ensures reference dropdowns show the full hierarchical path.

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

## Custom Record 2: CPS Item Category

**Record ID:** `customrecord_cps_item_category`

This is the junction record linking items to site categories (replaces `ItemSiteCategory`). It is rendered as a sublist on the Inventory Item record.

### Fields

| Field ID | Label | Type | Required | Notes |
|---|---|---|---|---|
| `custrecord_cps_product_line` | Product Line | List/Record → Product Line | No | The product line (parent classification) for the item. |
| `custrecord_cps_ic_item` | Item | List/Record → Item | Yes | The inventory item or kit item. **Mark as "Record is Parent"** to display this record as a sublist on the Inventory Item record. |
| `custrecord_cps_ic_site` | Site | Free-Form Text | No | The site this assignment applies to (e.g., "CPS"). |
| `custrecord_cps_ic_category` | Site Category | List/Record → `customrecord_cps_site_category` | Yes | The CPS Site Category this item is assigned to. |
| `custrecord_cps_ic_preferred` | Preferred | Check Box | No | Marks the primary category for items assigned to multiple categories. |
| `custrecord_cps_ic_description` | Description | Free-Form Text | No | Optional description/notes for this category assignment. |

### Configuration

- **Record Name:** CPS Item Category
- **Include Name Field:** Yes
- **Allow Inline Editing:** Yes
- **Allow Attachments:** Yes
- **Show Notes:** Yes
- **Show Remove Link:** Yes
- **Access Type:** Require Custom Record Entries Permission

### Important Notes

- Each item should have **exactly one** record marked as "Preferred" per site
- An item can have multiple category assignments (appear in multiple categories), but the preferred flag determines where it shows up in breadcrumbs and primary navigation
- If no preferred is set, the app will fall back to the first category assignment found
- To make this appear as a sublist on the Inventory Item record, edit the `custrecord_cps_ic_item` field and check **"Record is Parent"**

---

## Custom Record 3: Web Related Item

**Record ID:** `customrecord_web_related_item`

This stores cross-sell and upsell relationships between products (replaces `InventoryItemPresentationItem`).

### Fields

| Field ID | Label | Type | Required | Notes |
|---|---|---|---|---|
| `custrecord_webri_parent_item` | Parent Item | List/Record → Item | Yes | The main product |
| `custrecord_webri_related_item` | Related Item | List/Record → Item | Yes | The cross-sell/upsell product |
| `custrecord_webri_sort_order` | Sort Order | Integer | No | Controls display ordering of related items |

### Configuration

- **Record Name:** CPS Web Related Item
- **Include Name Field:** Optional

---

## Migrating Existing Data

To migrate your current SiteBuilder data into the new custom records, run a **Map/Reduce Script** in NetSuite that:

1. **Categories:** Queries `SiteCategory` and creates corresponding `customrecord_cps_site_category` records, preserving the parent-child relationships.

2. **Item Assignments:** Queries `ItemSiteCategory` and creates corresponding `customrecord_cps_item_category` records, mapping old category IDs to new custom record IDs.

3. **Related Items:** Queries `InventoryItemPresentationItem` and creates corresponding `customrecord_web_related_item` records.

> **Tip:** Migrate in order — categories first (parents before children), then item assignments, then related items.

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

**After (Custom Record):**
```sql
SELECT id, custrecord_cps_shortname AS itemid, name AS fullname,
       custrecord_cps_sub_category_of AS parentcategory,
       custrecord_cps_site AS site,
       custrecord_cps_category_level AS level
FROM customrecord_cps_site_category
WHERE isinactive = 'F'
ORDER BY name
```

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

**After (Custom Record):**
```sql
LEFT JOIN customrecord_cps_item_category cic_def
  ON cic_def.custrecord_cps_ic_item = item.id
  AND cic_def.custrecord_cps_ic_preferred = 'T'
LEFT JOIN (
  SELECT custrecord_cps_ic_item AS item, MIN(custrecord_cps_ic_category) AS category
  FROM customrecord_cps_item_category GROUP BY custrecord_cps_ic_item
) cic_any ON cic_any.item = item.id
```

And update the SELECT clause:
```sql
COALESCE(cic_def.custrecord_cps_ic_category, cic_any.category) AS sitecategoryid
```

### Related Items Query

**Before (SiteBuilder):**
```sql
SELECT superitem, presitemid, description, baseprice, onlineprice
FROM InventoryItemPresentationItem
```

**After (Custom Record):**
```sql
SELECT custrecord_webri_parent_item AS superitem,
       custrecord_webri_related_item AS presitemid
FROM customrecord_web_related_item
WHERE isinactive = 'F'
```

> **Note:** The `description`, `baseprice`, and `onlineprice` fields from the old related items table were sourced from the item record itself — these are still available by joining the item table if needed, but the current app fetches product details separately.

---

## Testing Checklist

After setting up the custom records and updating the queries:

- [ ] Create a few test categories with parent-child relationships
- [ ] Verify the `name` field auto-populates with the full path on save
- [ ] Assign items to categories with the "Preferred" flag
- [ ] Confirm the CPS Item Category sublist appears on the Inventory Item record
- [ ] Run a sync in the app and verify categories appear correctly
- [ ] Verify items show under the correct categories
- [ ] Verify related items display on product detail views
- [ ] Test renaming a parent category and re-saving children to update full names
- [ ] Confirm the Site Category dropdown on the CPS Item Category record shows full paths

---

## Summary

| Step | Where | What |
|---|---|---|
| 1 | NetSuite | Create the 3 custom records |
| 2 | NetSuite | Deploy the User Event script for full name generation |
| 3 | NetSuite | Migrate existing SiteBuilder data to the new records |
| 4 | Application | Update SuiteQL queries in `netsuite.ts` |
| 5 | Both | Test end-to-end sync and verify data integrity |

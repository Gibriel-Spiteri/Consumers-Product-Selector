# Building Custom Web Categories in NetSuite

This guide covers how to replace NetSuite's SiteBuilder category system with custom records, and how to connect them to the CPS application.

---

## Overview

The SiteBuilder integration provides three tables we need to replace:

| SiteBuilder Table | Purpose | Custom Replacement |
|---|---|---|
| `SiteCategory` | Category tree (name, parent, hierarchy, online flag) | `customrecord_web_category` |
| `ItemSiteCategory` | Links items to categories (many-to-many) | `customrecord_web_category_item` |
| `InventoryItemPresentationItem` | Related/cross-sell item relationships | `customrecord_web_related_item` |

---

## Custom Record 1: Web Category

**Record ID:** `customrecord_web_category`

This stores the category hierarchy (replaces `SiteCategory`).

### Fields

| Field ID | Label | Type | Required | Notes |
|---|---|---|---|---|
| `name` (built-in) | Name | Text | Yes | Short display name (e.g., "23\" to 28\" Wide") |
| `custrecord_webcat_fullname` | Full Name | Text | No | Auto-generated full path (e.g., "Bath : Cabinetry : 23\" to 28\" Wide"). Used by the app to determine hierarchy depth. |
| `custrecord_webcat_parent` | Parent Category | List/Record (self-reference) | No | Points to the parent `customrecord_web_category` record. Leave blank for top-level categories. |
| `custrecord_webcat_sort_order` | Sort Order | Integer | No | Controls display ordering within a level |
| `custrecord_webcat_is_online` | Is Online | Checkbox | No | Controls whether the category is visible in the app |

### Configuration

- **Record Name:** CPS Web Category
- **Include Name Field:** Yes
- **Allow Inline Editing:** Yes (recommended for easier management)
- **Show ID:** Yes (helpful for debugging)

### Full Name Auto-Generation (User Event Script)

Deploy a **User Event Script** (Before Submit) on `customrecord_web_category` to automatically build the `custrecord_webcat_fullname` field. This replicates the behavior of SiteBuilder's built-in `fullname` field.

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
        var name = rec.getValue({ fieldId: 'name' });
        var parentId = rec.getValue({ fieldId: 'custrecord_webcat_parent' });

        var fullName = buildFullName(name, parentId);
        rec.setValue({ fieldId: 'custrecord_webcat_fullname', value: fullName });
    }

    function buildFullName(name, parentId) {
        var parts = [name];

        while (parentId) {
            var parentLookup = search.lookupFields({
                type: 'customrecord_web_category',
                id: parentId,
                columns: ['name', 'custrecord_webcat_parent']
            });

            parts.unshift(parentLookup.name);

            var parentRefs = parentLookup.custrecord_webcat_parent;
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
- **Applied To:** `customrecord_web_category`
- **Event Type:** Before Submit (Create & Edit)
- **Status:** Released

> **Important:** When renaming a parent category, you will also need to trigger an update on all child categories to regenerate their full names. This can be handled with a scheduled script or a Map/Reduce script that finds all descendants and re-saves them.

---

## Custom Record 2: Web Category Item

**Record ID:** `customrecord_web_category_item`

This is the junction record linking items to categories (replaces `ItemSiteCategory`).

### Fields

| Field ID | Label | Type | Required | Notes |
|---|---|---|---|---|
| `custrecord_webci_category` | Web Category | List/Record → `customrecord_web_category` | Yes | The category this item belongs to |
| `custrecord_webci_item` | Item | List/Record → Item | Yes | The inventory item or kit item |
| `custrecord_webci_is_default` | Is Default | Checkbox | No | Marks the primary category for items in multiple categories. The app uses this to determine which category an item "belongs to." |
| `custrecord_webci_sort_order` | Sort Order | Integer | No | Controls item ordering within the category |

### Configuration

- **Record Name:** CPS Web Category Item
- **Include Name Field:** Optional (can auto-generate from category + item)
- **Allow Inline Editing:** Yes

### Important Notes

- Each item should have **exactly one** record marked as "Is Default"
- An item can have multiple category assignments (appear in multiple categories), but the default determines where it shows up in breadcrumbs and primary navigation
- If no default is set, the app will fall back to the first category assignment found

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

1. **Categories:** Queries `SiteCategory` and creates corresponding `customrecord_web_category` records, preserving the parent-child relationships and online flags.

2. **Item Assignments:** Queries `ItemSiteCategory` and creates corresponding `customrecord_web_category_item` records, mapping old category IDs to new custom record IDs.

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
SELECT id, name AS itemid, custrecord_webcat_fullname AS fullname,
       custrecord_webcat_parent AS parentcategory,
       custrecord_webcat_is_online AS isonline
FROM customrecord_web_category
WHERE isinactive = 'F'
ORDER BY custrecord_webcat_fullname
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
LEFT JOIN customrecord_web_category_item wci_def
  ON wci_def.custrecord_webci_item = item.id
  AND wci_def.custrecord_webci_is_default = 'T'
LEFT JOIN (
  SELECT custrecord_webci_item AS item, MIN(custrecord_webci_category) AS category
  FROM customrecord_web_category_item GROUP BY custrecord_webci_item
) wci_any ON wci_any.item = item.id
```

And update the SELECT clause:
```sql
COALESCE(wci_def.custrecord_webci_category, wci_any.category) AS sitecategoryid
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
- [ ] Verify the `fullname` field auto-populates correctly on save
- [ ] Assign items to categories with the "Is Default" flag
- [ ] Run a sync in the app and verify categories appear correctly
- [ ] Verify items show under the correct categories
- [ ] Verify related items display on product detail views
- [ ] Test renaming a parent category and re-saving children to update full names
- [ ] Confirm the category dropdown on the CPS Item Category record shows full paths

---

## Summary

| Step | Where | What |
|---|---|---|
| 1 | NetSuite | Create the 3 custom records |
| 2 | NetSuite | Deploy the User Event script for full name generation |
| 3 | NetSuite | Migrate existing SiteBuilder data to the new records |
| 4 | Application | Update SuiteQL queries in `netsuite.ts` |
| 5 | Both | Test end-to-end sync and verify data integrity |

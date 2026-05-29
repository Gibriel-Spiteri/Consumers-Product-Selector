# NetSuite Queried Fields

## `customrecord_cps_site_category` — Categories
| Field | Alias |
|---|---|
| `id` | — |
| `name` | `fullname` |
| `custrecord_cps_sub_category_of` | `parentcategory` |
| `isinactive` | *(filter only)* |

---

## `InventoryItem` — Inventory Items
| Field | Alias |
|---|---|
| `item.id` | — |
| `item.itemid` | — |
| `item.fullname` | — |
| `item.salesdescription` | — |
| `item.custitem_normalretailprice` | `retailprice` |
| `item.custitem_std_retprice` | `consumersprice` |
| `item.custitem_itemthumbnailurl` | `imageurl` |
| `item.custitem_itemimageurl` | `fullimageurl` |
| `item.storedescription` | — |
| `item.custitem_prodline` | `prodline` *(display value)* |
| `item.custitem_collection` | `collection` *(display value)* |
| `item.quantityavailable` | — |
| `item.custitem_noreorders` | `isnoreorder` |
| `item.custitem_expressbath` | `isexpressbath` |
| `item.custitem_specord_stock` | `isspecialorderstock` |
| `item.isonline` | — |
| `item.custitem_cps_category` | `cpscategoryid` |
| `item.leadtime` | `itemleadtime` |
| `item.quantityonorder` | — |
| `item.quantitybackordered` | — |
| `item.custitem_dateadded` | `dateadded` |
| `item.custitem_stock_code` | *(filter only)* |
| `p.unitprice` | `baseprice` *(from `pricing` join, pricelevel=1)* |

---

## `KitItem` — Kit Items
*(Same fields as InventoryItem above, except `salesdescription` comes from `item.description` and quantity fields are `NULL`)*

---

## `customrecord_pl` — Product Line (joined to items)
| Field | Alias |
|---|---|
| `pl.custrecord_pl_leadtime` | `prodlineleadtime` |
| `pl.custrecord_pl_ordercycle` | `prodlineordercycle` |

---

## `customrecord_itemimg` — Additional Item Images
| Field | Alias |
|---|---|
| `id` | — |
| `custrecord_itemimg_url` | — |
| `custrecord_itemimg_displayorder` | — |
| `custrecord_itemimg_item` | *(filter only)* |
| `isinactive` | *(filter only)* |

---

## `customrecord_ppr` + `customrecord_ppritem` — Price Promotion
| Field | Alias |
|---|---|
| `pi.custrecord_ppritem_item` | — |
| `ppr.name` | `pprname` |
| `ppr.custrecord_ppr_pricereddisplay_ret` | — |
| `ppr.custrecord_ppr_status` | *(filter only)* |
| `pi.isinactive` | *(filter only)* |

---

## `CUSTOMRECORD_ITEMATRBVAL` — Item Attributes
| Field | Alias |
|---|---|
| `iav.id` | — |
| `iav.custrecord_itematrbval_item` | `itemid` |
| `i.itemid` | `sku` |
| `iav.custrecord_itematrbval_displayname` | `attributename` |
| `iav.custrecord_itematrbval_val` | `valueid` |
| `iav.custrecord_itematrbval_val` | `valuename` *(display value)* |
| `iav.custrecord_itematrbval_sortorder` | `sortorder` |
| `iav.custrecord_itematrbval_filter` | `isfilter` |
| `iav.isinactive` | *(filter only)* |

---

## `InventoryItemPresentationItem` — Related Items
| Field | Alias |
|---|---|
| `superitem` | — |
| `presitemid` | — |
| `description` | — |
| `baseprice` | — |
| `onlineprice` | — |

---

## `iteminventorybalance` + `bin` — Bin Numbers
| Field | Alias |
|---|---|
| `iib.item` | `itemid` |
| `b.binnumber` | `binname` |
| `b.custrecord_bin_isdisplay` | `isdisplay` |
| `iib.quantityonhand` | `qty` |
| `b.isinactive` | *(filter only)* |

---

## `transaction` + `transactionLine` — Sales Usage (12-month & 3-month)
| Field | Alias |
|---|---|
| `tl.item` | `itemid` |
| `tl.quantity` | `qty` *(summed)* |
| `t.type` | *(filter: `SalesOrd`)* |
| `t.trandate` | *(filter: last N months)* |
| `c.custentity_isinternal` | *(filter: exclude internal customers)* |

---

## `TransactionLine` + `Transaction` — Open PO Receipt Dates (for ATP)
| Field | Alias |
|---|---|
| `tl.item` | — |
| `tl.expectedreceiptdate` | — |
| `tl.quantity` | — |
| `tl.quantityshiprecv` | — |
| `t.type` | *(filter: `PurchOrd`)* |
| `t.customform` | *(filter: form 154)* |
| `t.status` | *(filter: open statuses)* |

---

## `KitItemMember` + `InventoryItem` — Kit Inventory (live lookup)
| Field | Alias |
|---|---|
| `km.parentitem` | `kitid` |
| `km.item` | `memberid` |
| `km.quantity` | — |
| `inv.quantityavailable` | `memberqtyavailable` |

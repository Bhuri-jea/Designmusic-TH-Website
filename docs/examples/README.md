# Inventory sample

[inventory-one-each-example.sql](inventory-one-each-example.sql) preserves the owner's supplied example verbatim. It overwrites every inventory SKU count with one; it is not an authorized stock initialization, and it is excluded from migrations.

Do not run this sample when real stock is unknown or during deployment setup. All nine catalog seeds remain at zero. Enter actual counts through the authenticated admin controls when the owner knows them.

## Archived alternate implementations — DO NOT APPLY

legacy-bookings-202610130001.sql and legacy-orders-inventory-outbox.sql.archived preserve the original bytes from the owner checkout. They are historical source, not migrations or opt-in production examples. The duplicate booking migration would fail after accepted003 and its validation differs from the reviewed contract. The older order/outbox draft has obsolete event/retry rules. No data was changed by moving these files.

If an external database already applied an archived migration, inspect that schema and create a reviewed forward reconciliation migration; this archive operation does not reconcile existing external data. The owner commits/index/history remain intact.

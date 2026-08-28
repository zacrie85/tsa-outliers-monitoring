"""Migration: Convert customData keys from CUID (col.id) to column name (col.name).

Problem: Import route previously stored customData with CUID keys like:
  { "clx1abc234": "Ahmad sopian" }

But the app (cell editor, pivot table, forms) expects name keys like:
  { "pic_permit": "Ahmad sopian" }

This script reads all CustomColumns to build an id→name map, then updates
all MonitoringRow.customData entries, replacing CUID keys with name keys.
"""

import json
import sqlite3
import os

def main():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'db', 'custom.db')
    
    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        return

    print(f"Database: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        # Step 1: Build id→name map from CustomColumn
        print("\n[1/3] Reading CustomColumn table...")
        cur.execute('SELECT id, name, label FROM CustomColumn')
        columns = cur.fetchall()

        if not columns:
            print("  No custom columns found. Nothing to migrate.")
            return

        id_to_name = {}
        for col_id, col_name, col_label in columns:
            id_to_name[col_id] = col_name
            print(f"  {col_id} → {col_name} ({col_label})")
        print(f"  Total: {len(columns)} custom columns")

        # Step 2: Read rows with customData
        print("\n[2/3] Scanning MonitoringRow.customData...")
        cur.execute('SELECT id, customData FROM MonitoringRow WHERE customData IS NOT NULL AND customData != \'{}\' AND customData != \'\'')
        rows = cur.fetchall()
        print(f"  Total rows with customData: {len(rows)}")

        # Step 3: Migrate keys
        print("\n[3/3] Migrating keys (CUID → name)...")
        updated = 0
        unchanged = 0
        errors = 0

        for row_id, custom_data_str in rows:
            try:
                data = json.loads(custom_data_str)
                if not isinstance(data, dict) or len(data) == 0:
                    unchanged += 1
                    continue

                new_data = {}
                needs_update = False

                for key, value in data.items():
                    if key in id_to_name:
                        new_key = id_to_name[key]
                        if new_key != key:
                            needs_update = True
                            if new_key in new_data and new_data[new_key]:
                                continue
                            new_data[new_key] = value
                        else:
                            new_data[key] = value
                    else:
                        new_data[key] = value

                if needs_update:
                    new_json = json.dumps(new_data, ensure_ascii=False)
                    cur.execute('UPDATE MonitoringRow SET customData = ? WHERE id = ?', (new_json, row_id))
                    updated += 1
                    if updated <= 5:
                        print(f"  Updated row {row_id[:12]}...")
                    elif updated == 6:
                        print(f"  ... (more updates)")
                else:
                    unchanged += 1

            except (json.JSONDecodeError, Exception) as e:
                errors += 1
                if errors <= 3:
                    print(f"  Error on row {row_id[:12]}...: {e}")

        conn.commit()

        print(f"\n{'='*50}")
        print(f"Migration complete!")
        print(f"  Updated: {updated} rows")
        print(f"  Unchanged: {unchanged} rows")
        print(f"  Errors: {errors} rows")
        print(f"{'='*50}")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()


if __name__ == '__main__':
    main()

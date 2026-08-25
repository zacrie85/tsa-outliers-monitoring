import re

# Helper to add import and replace fetch calls

def update_file(filepath, fetch_replacements, import_line=None):
    """
    fetch_replacements: list of (old_pattern, new_call)
    """
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Add import if provided and not already present
    if import_line and 'apiFetch' not in content:
        # Find the first import line
        lines = content.split('\n')
        insert_idx = 0
        for i, line in enumerate(lines):
            if line.startswith("import") or line.startswith("'use client'"):
                insert_idx = i + 1
            elif line.strip() == '' and insert_idx > 0:
                break
        lines.insert(insert_idx, import_line)
        content = '\n'.join(lines)
    
    # Apply replacements
    for old, new in fetch_replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'  Updated: {filepath}')

# === 1. monitoring-table.tsx ===
print('1. monitoring-table.tsx')
update_file(
    '/home/z/my-project/src/components/monitoring/monitoring-table.tsx',
    [
        ("fetch('/api/monitoring'),", "apiFetch('/api/monitoring'),"),
        ("fetch('/api/columns'),", "apiFetch('/api/columns'),"),
        # Import with projectId in FormData
        ("body: fd });", "body: fd }); // projectId auto-injected via URL by import route"),
        # Clear
        ("fetch('/api/monitoring/clear', { method: 'DELETE' })", "apiFetch('/api/monitoring/clear', { method: 'DELETE' })"),
        # POST to monitoring
        ("fetch('/api/monitoring', {", "apiFetch('/api/monitoring', {"),
    ],
    "import { apiFetch } from '@/lib/api';"
)

# === 2. dashboard-charts.tsx ===
print('2. dashboard-charts.tsx')
update_file(
    '/home/z/my-project/src/components/dashboard/dashboard-charts.tsx',
    [
        ("fetch('/api/charts'),", "apiFetch('/api/charts'),"),
        ("fetch('/api/monitoring'),", "apiFetch('/api/monitoring'),"),
        ("fetch('/api/columns'),", "apiFetch('/api/columns'),"),
        ("await fetch('/api/charts', {", "await apiFetch('/api/charts', {"),
    ],
    "import { apiFetch } from '@/lib/api';"
)

# === 3. pivot-charts.tsx ===
print('3. pivot-charts.tsx')
update_file(
    '/home/z/my-project/src/components/pivot/pivot-charts.tsx',
    [
        ("fetch('/api/monitoring'),", "apiFetch('/api/monitoring'),"),
        ("fetch('/api/columns'),", "apiFetch('/api/columns'),"),
    ],
    "import { apiFetch } from '@/lib/api';"
)

print('\nAll frontend fetch calls updated!')

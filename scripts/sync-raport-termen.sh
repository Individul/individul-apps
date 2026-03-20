#!/bin/bash
set -euo pipefail

# Configuration
SOURCE_FILE="$HOME/Documents/Raport termen.numbers"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSH_KEY="$REPO_ROOT/.ssh/hetzner_key"
SERVER="root@46.224.209.71"
REMOTE_PATH="/opt/mega-app/raport-data/raport-termen.json"
MARKER_FILE="/tmp/.raport-termen-last-sync"
LOG_FILE="/tmp/raport-termen-sync.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

# Check if source file exists
if [ ! -f "$SOURCE_FILE" ]; then
    log "Source file not found: $SOURCE_FILE"
    exit 0
fi

# Check if a manual sync was requested from the web UI
FORCE_SYNC=false
REMOTE_FLAG=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$SERVER" \
    "cat /opt/mega-app/raport-data/.sync-requested 2>/dev/null && rm -f /opt/mega-app/raport-data/.sync-requested" 2>/dev/null || true)
if [ -n "$REMOTE_FLAG" ]; then
    log "Manual sync requested from web UI"
    FORCE_SYNC=true
fi

# Check if file has been modified since last sync
FILE_MTIME=$(stat -f '%m' "$SOURCE_FILE")
if [ "$FORCE_SYNC" = false ] && [ -f "$MARKER_FILE" ]; then
    LAST_SYNC=$(cat "$MARKER_FILE")
    if [ "$FILE_MTIME" -le "$LAST_SYNC" ]; then
        log "File unchanged since last sync. Skipping."
        exit 0
    fi
fi

log "File modified, starting conversion..."

# Convert .numbers to JSON using Python
TEMP_JSON="/tmp/raport-termen.json"
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -c "
import json
from numbers_parser import Document

doc = Document('$SOURCE_FILE')
sheet = doc.sheets[0]
table = sheet.tables[0]

num_cols = table.num_cols

# Detect if first row is header or data
first_cell = table.cell(0, 0).value
first_val = str(first_cell).strip().lower() if first_cell else ''
has_header = first_val in ('nr', 'nr.', '№', 'nume', 'numele')
start_row = 1 if has_header else 0

# Detect column layout
if has_header:
    headers = []
    for col in range(num_cols):
        cell = table.cell(0, col)
        val = cell.value if cell.value is not None else ''
        headers.append(str(val).strip().lower())
    col_map = {}
    for i, h in enumerate(headers):
        if h in ('nr', 'nr.', '№'):
            col_map['nr'] = i
        elif h in ('nume', 'numele'):
            col_map['nume'] = i
        elif h in ('prenume', 'prenumele'):
            col_map['prenume'] = i
        elif h in ('patronimic', 'patronimicul'):
            col_map['patronimic'] = i
        elif 'sfarsit' in h or 'sfîrșit' in h or 'data' in h:
            col_map['datasfarsit'] = i
else:
    # No header: auto-detect layout by checking first data row
    # Check if first column is numeric (Nr) or text (Nume)
    first_val = table.cell(0, 0).value
    first_is_number = isinstance(first_val, (int, float))

    # Count actual non-empty columns in first row
    actual_cols = 0
    for c in range(num_cols):
        v = table.cell(0, c).value
        if v is not None and str(v).strip():
            actual_cols += 1

    if first_is_number:
        # Nr, Nume, Prenume, Patronimic, Data
        col_map = {'nr': 0, 'nume': 1, 'prenume': 2, 'patronimic': 3, 'datasfarsit': 4}
    elif actual_cols <= 3:
        # Nume, Prenume, Data (no patronimic)
        col_map = {'nume': 0, 'prenume': 1, 'datasfarsit': 2}
    else:
        # Nume, Prenume, Patronimic, Data (possibly with trailing empty cols)
        # Find the date column by checking types
        date_col = None
        for c in range(num_cols):
            v = table.cell(0, c).value
            if hasattr(v, 'strftime'):
                date_col = c
                break
        if date_col is not None:
            if date_col == 2:
                col_map = {'nume': 0, 'prenume': 1, 'datasfarsit': 2}
            elif date_col == 3:
                col_map = {'nume': 0, 'prenume': 1, 'patronimic': 2, 'datasfarsit': 3}
            else:
                col_map = {'nume': 0, 'prenume': 1, 'patronimic': 2, 'datasfarsit': date_col}
        else:
            col_map = {'nume': 0, 'prenume': 1, 'patronimic': 2, 'datasfarsit': 3}

records = []
for row in range(start_row, table.num_rows):
    # Get name - skip empty rows
    nume_val = table.cell(row, col_map.get('nume', 0)).value
    if not nume_val or not str(nume_val).strip():
        continue

    nume = str(nume_val).strip()
    prenume = str(table.cell(row, col_map.get('prenume', 1)).value or '').strip()

    patronimic_col = col_map.get('patronimic')
    if patronimic_col is not None and patronimic_col < num_cols:
        pat_val = table.cell(row, patronimic_col).value
        patronimic = str(pat_val).strip() if pat_val and str(pat_val).strip() not in ('-', '') else None
    else:
        patronimic = None

    date_col = col_map.get('datasfarsit')
    if date_col is not None and date_col < num_cols:
        date_val = table.cell(row, date_col).value
        if hasattr(date_val, 'strftime'):
            datasfarsit = date_val.strftime('%Y-%m-%d')
        elif date_val:
            ds = str(date_val).strip()
            # Handle datetime strings like '2034-06-11 00:00:00'
            datasfarsit = ds[:10] if len(ds) >= 10 else ds
        else:
            datasfarsit = ''
    else:
        datasfarsit = ''

    nr_col = col_map.get('nr')
    if nr_col is not None:
        nr_val = table.cell(row, nr_col).value
        nr = int(nr_val) if isinstance(nr_val, (int, float)) else row + 1
    else:
        nr = row + 1 - start_row

    records.append({
        'nr': nr,
        'nume': nume,
        'prenume': prenume,
        'patronimic': patronimic,
        'datasfarsit': datasfarsit,
    })

with open('$TEMP_JSON', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False)

print(f'Converted {len(records)} records')
"

if [ $? -ne 0 ]; then
    log "ERROR: Conversion failed"
    exit 1
fi

RECORD_COUNT=$(/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -c "import json; print(len(json.load(open('$TEMP_JSON'))))")
log "Converted $RECORD_COUNT records"

# SCP to server
log "Uploading to server..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$TEMP_JSON" "$SERVER:$REMOTE_PATH"

if [ $? -eq 0 ]; then
    echo "$FILE_MTIME" > "$MARKER_FILE"
    log "SUCCESS: Uploaded $RECORD_COUNT records to server"
else
    log "ERROR: SCP upload failed"
    exit 1
fi

rm -f "$TEMP_JSON"

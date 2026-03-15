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

# Check if file has been modified since last sync
FILE_MTIME=$(stat -f '%m' "$SOURCE_FILE")
if [ -f "$MARKER_FILE" ]; then
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

# Read header row to find column indices
headers = []
for col in range(table.num_cols):
    cell = table.cell(0, col)
    val = cell.value if cell.value is not None else ''
    headers.append(str(val).strip().lower())

# Map expected columns
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

records = []
for row in range(1, table.num_rows):
    nr_val = table.cell(row, col_map.get('nr', 0)).value
    if nr_val is None:
        continue

    nume = table.cell(row, col_map.get('nume', 1)).value or ''
    prenume = table.cell(row, col_map.get('prenume', 2)).value or ''
    patronimic_val = table.cell(row, col_map.get('patronimic', 3)).value
    patronimic = str(patronimic_val).strip() if patronimic_val else None

    date_cell = table.cell(row, col_map.get('datasfarsit', 4))
    date_val = date_cell.value

    if hasattr(date_val, 'strftime'):
        datasfarsit = date_val.strftime('%Y-%m-%d')
    elif date_val:
        datasfarsit = str(date_val)
    else:
        datasfarsit = ''

    records.append({
        'nr': int(nr_val) if isinstance(nr_val, (int, float)) else row,
        'nume': str(nume).strip(),
        'prenume': str(prenume).strip(),
        'patronimic': patronimic if patronimic else None,
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

import os
import shutil
import json
import pandas as pd
from datetime import date, datetime, time

def default_converter(o):
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, time):
        return o.strftime("%H:%M:%S")
    return str(o)

def clean_value(val):
    if pd.isna(val):
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, time):
        return val.strftime("%H:%M:%S")
    return val

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_modul = os.path.join(base_dir, "Modul-petunjuk-capestone", "Data_Contoh_HRIS.xlsx")
    file_root = os.path.join(base_dir, "Data_Contoh_HRIS.xlsx")

    target_excel = None
    if os.path.exists(file_modul):
        target_excel = file_modul
    elif os.path.exists(file_root):
        target_excel = file_root
        # Also copy to Modul-petunjuk-capestone for consistency
        os.makedirs(os.path.dirname(file_modul), exist_ok=True)
        shutil.copy2(file_root, file_modul)
        print(f"Copied {file_root} to {file_modul}")

    if not target_excel:
        print("File Data_Contoh_HRIS.xlsx not found!")
        return

    print(f"Reading Excel file: {target_excel}")
    output_dir = os.path.join(base_dir, "data", "seeds")
    os.makedirs(output_dir, exist_ok=True)

    xls = pd.ExcelFile(target_excel)
    print(f"Found sheets: {xls.sheet_names}")

    summary = {}
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        
        # Replace NaN with None
        records = df.to_dict(orient="records")
        cleaned_records = []
        for row in records:
            cleaned_row = {k: clean_value(v) for k, v in row.items()}
            cleaned_records.append(cleaned_row)

        safe_sheet_name = sheet_name.strip().replace(" ", "_").lower()
        output_file = os.path.join(output_dir, f"{safe_sheet_name}.json")
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(cleaned_records, f, indent=2, default=default_converter, ensure_ascii=False)
            
        print(f"-> Extracted sheet '{sheet_name}' ({len(cleaned_records)} rows) -> {output_file}")
        summary[safe_sheet_name] = {
            "original_name": sheet_name,
            "row_count": len(cleaned_records),
            "columns": list(df.columns)
        }

    summary_file = os.path.join(output_dir, "_summary.json")
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"All sheets successfully extracted to {output_dir}")

if __name__ == "__main__":
    main()

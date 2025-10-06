import os
import csv
from datetime import date
import codicefiscale

# --- Configuration ---
NUM_CODES = 10000000
OUTPUT_FOLDER = 'assets'
OUTPUT_FILE = 'fc_list_10M.csv'
OUTPUT_PATH = os.path.join(OUTPUT_FOLDER, OUTPUT_FILE)
START_YEAR = 2200
END_YEAR = 2299  # 100 years window
START_MUNICIPALITY = 1
MAX_MUNICIPALITY = 999  # Z001-Z999
# -------------------

def get_fake_municipality(idx):
    # Returns a fake codice catastale in the form Z001, Z002, ..., Z999
    return f"Z{idx:03d}"

def generate_fiscal_codes():
    """
    Generates a CSV file with a specified number of deterministic, unique, and valid
    Italian fiscal codes using fake data.
    The script will not overwrite an existing file.
    """
    # Ensure the assets directory exists
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)

    # Check if the file already exists to avoid regeneration
    if os.path.exists(OUTPUT_PATH):
        print(f"File '{OUTPUT_PATH}' already exists. Skipping generation.")
        return

    print(f"Generating {NUM_CODES} fiscal codes. This may take a while...")

    try:
        with open(OUTPUT_PATH, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['CF'])

            year_range = END_YEAR - START_YEAR + 1
            municipality_range = MAX_MUNICIPALITY - START_MUNICIPALITY + 1

            for i in range(NUM_CODES):
                surname = f"Cognome{i}"
                name = f"Nome{i}"
                # Deterministic date: day 1-28, month 1-12, year cycles in window
                day = (i % 28) + 1
                month = (i % 12) + 1
                year = START_YEAR + (i % year_range)
                birthday = date(year, month, day)
                sex = 'M' if i % 2 == 0 else 'F'
                # Deterministic fake municipality
                municipality_idx = (i % municipality_range) + START_MUNICIPALITY
                municipality = get_fake_municipality(municipality_idx)

                cf = codicefiscale.build(
                    surname=surname,
                    name=name,
                    birthday=birthday,
                    sex=sex,
                    municipality=municipality
                )
                writer.writerow([cf])

                if (i + 1) % 10000 == 0:
                    print(f"  ...generated {i + 1}/{NUM_CODES} codes")

        print(f"\nSuccessfully generated {NUM_CODES} fiscal codes in '{OUTPUT_PATH}'.")

    except Exception as e:
        print(f"An error occurred: {e}")
        if os.path.exists(OUTPUT_PATH):
            os.remove(OUTPUT_PATH)

if __name__ == "__main__":
    print("--- Fiscal Code List Generator ---")
    generate_fiscal_codes()
    print("----------------------------------")

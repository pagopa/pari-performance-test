import os
import csv
import random
from datetime import date
import codicefiscale

# --- Configuration ---
NUM_CODES = 10000000
OUTPUT_FOLDER = 'assets'
OUTPUT_FILE = 'fc_list_10M.csv'
OUTPUT_PATH = os.path.join(OUTPUT_FOLDER, OUTPUT_FILE)
# -------------------

def generate_fiscal_codes():
    """
    Generates a CSV file with a specified number of random but valid
    Italian fiscal codes using fake data.
    The script will not overwrite an existing file.
    """
    # Ensure deterministic behavior by setting a fixed random seed
    random.seed(42)

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
            # Write header
            writer.writerow(['CF'])

            # Generate and write fiscal codes
            for i in range(NUM_CODES):
                surname = f"Cognome{i}"
                name = f"Nome{i}"
                birthday = date(2200, random.randint(1, 12), random.randint(1, 28))
                sex = random.choice(['M', 'F'])
                municipality = 'Z999'  # Fake codice catastale

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
        # Clean up partially created file on error
        if os.path.exists(OUTPUT_PATH):
            os.remove(OUTPUT_PATH)

if __name__ == "__main__":
    print("--- Fiscal Code List Generator ---")
    generate_fiscal_codes()
    print("----------------------------------")


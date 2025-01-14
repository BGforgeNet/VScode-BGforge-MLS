#!/usr/bin/env python3

import yaml
import argparse


def main():
    parser = argparse.ArgumentParser(description="Convert a list of items into a structured YAML format.")
    parser.add_argument("input_file", help="Path to the IDS list.")
    parser.add_argument("doc_value", help="IDS filename to display in tooltips")
    parser.add_argument("output_file", help="Path to the output YAML file.")

    args = parser.parse_args()

    try:
        with open(args.input_file, "r") as file:
            lines = file.readlines()

        data = []
        for line in lines:
            line = line.strip()
            if line:  # Skip empty lines
                parts = line.split()
                if len(parts) == 2:
                    value, name = parts
                    data.append({"name": name, "detail": value, "doc": args.doc_value})

        with open(args.output_file, "w") as file:
            yaml.dump(data, file, default_flow_style=False, sort_keys=False)

        print(f"Output written to {args.output_file}")

    except FileNotFoundError:
        print(f"File not found: {args.input_file}")
    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    main()

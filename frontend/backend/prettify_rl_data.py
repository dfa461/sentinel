#!/usr/bin/env python3
"""
Script to prettify rl_training_data.json (JSONL format)
Usage: python prettify_rl_data.py
"""
import json

def prettify_jsonl(input_file='rl_training_data.json', output_file='rl_training_data_pretty.json'):
    """Convert JSONL to prettified JSON array"""
    assessments = []

    try:
        with open(input_file, 'r') as f:
            for line in f:
                if line.strip():
                    assessments.append(json.loads(line))

        # Write as pretty JSON array
        with open(output_file, 'w') as f:
            json.dump(assessments, f, indent=2)

        print(f"✓ Prettified {len(assessments)} assessments")
        print(f"✓ Saved to: {output_file}")

        # Also print the latest assessment
        if assessments:
            print("\n" + "="*60)
            print("LATEST ASSESSMENT:")
            print("="*60)
            print(json.dumps(assessments[-1], indent=2))

    except FileNotFoundError:
        print(f"Error: {input_file} not found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    prettify_jsonl()

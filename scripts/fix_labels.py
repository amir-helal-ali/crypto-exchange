#!/usr/bin/env python3
"""
Fix a11y warning: 'A form label must be associated with a control'.

When a <label> element doesn't have a `for` attribute and isn't wrapping a control,
Svelte warns. For text labels that are siblings of inputs (not wrapping them and
not pointing to them with `for=`), the simplest fix is to convert them to <span>
with the same class — they're being used purely for styling, not for semantic labels.

This script targets <label class="...">TEXT</label> patterns where the label is
NOT immediately wrapping an input/select/textarea, and converts them to <span>.
"""

import re
import sys
from pathlib import Path


# Match <label ...>TEXT</label> on a single line — common pattern in this codebase
LABEL_PATTERN = re.compile(
    r'<label(\s[^>]*)?>([^<]*)</label>',
    re.IGNORECASE
)


def transform_label(match: re.Match) -> str:
    attrs = match.group(1) or ''
    text = match.group(2)
    # If the label already has a `for=` attribute, leave it alone (it's correctly associated)
    if re.search(r'\sfor\s*=', attrs, re.IGNORECASE):
        return match.group(0)
    # Otherwise, convert to <span>
    return f'<span{attrs}>{text}</span>'


def transform_file(path: Path) -> int:
    content = path.read_text(encoding='utf-8')
    new_content, n = LABEL_PATTERN.subn(transform_label, content)
    if n > 0 and new_content != content:
        path.write_text(new_content, encoding='utf-8')
    return n


def main():
    if len(sys.argv) < 2:
        print("Usage: fix_labels.py <dir>")
        sys.exit(1)
    root = Path(sys.argv[1])
    total = 0
    for svelte in sorted(root.rglob('*.svelte')):
        n = transform_file(svelte)
        if n:
            print(f"  {svelte}: {n} label(s) converted")
            total += n
    print(f"Done. Total labels converted: {total}")


if __name__ == '__main__':
    main()

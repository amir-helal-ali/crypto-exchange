#!/usr/bin/env python3
"""
Fix event attributes that lost their `on` prefix during the previous (buggy)
event conversion. Specifically:
  click={...}      -> onclick={...}
  submit={...}     -> onsubmit={...}
  mousedown={...}  -> onmousedown={...}
  etc.

Only converts attribute forms that look like event handler assignments
(pattern: NAME={...} where NAME is a known event) — leaves `bind:value={...}`,
`class={...}`, etc. alone.
"""

import re
import sys
from pathlib import Path


# Event names — bare (without `on` prefix)
EVENT_NAMES = {
    'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave',
    'mouseover', 'mouseout', 'keydown', 'keyup', 'keypress', 'input', 'change',
    'submit', 'reset', 'focus', 'blur', 'focusin', 'focusout', 'wheel', 'scroll',
    'contextmenu', 'drag', 'dragend', 'dragenter', 'dragleave', 'dragover', 'dragstart', 'drop',
    'touchstart', 'touchend', 'touchmove', 'touchcancel',
}


# Match: EVENTNAME={...} (the `{` is opening a Svelte expression)
# Not anchored — we'll verify the preceding char to ensure this is an attribute position.
ATTR_PATTERN = re.compile(r'([a-zA-Z]+)=\{')


def find_balance(s: str, start: int) -> int:
    """Given s and position of '{', find the matching '}'."""
    assert s[start] == '{'
    depth = 1
    i = start + 1
    in_str = None
    while i < len(s):
        c = s[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in '"\'`':
            in_str = c
            i += 1
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def transform_file(path: Path) -> int:
    content = path.read_text(encoding='utf-8')
    out = []
    i = 0
    n = len(content)
    changes = 0
    while i < n:
        # Look at the start of a "word" — preceded by whitespace, /, or >
        # Find next attribute-pattern start
        m = ATTR_PATTERN.search(content, i)
        if not m:
            out.append(content[i:])
            break
        # Check what's immediately before — must be whitespace, '/', '>', letter, digit, quote, or newline
        # so we don't match in the middle of a class name or string.
        before_pos = m.start() - 1
        while before_pos >= 0 and content[before_pos] in ' \t\r\n':
            before_pos -= 1
        if before_pos < 0:
            out.append(content[i:m.end()])
            i = m.end()
            continue
        prev_char = content[before_pos]
        # Allowed preceding chars: /, >, ", ', letters, digits, } (end of previous {expr} attribute)
        if not (prev_char in '/>"\'{}' or prev_char.isalnum()):
            out.append(content[i:m.end()])
            i = m.end()
            continue
        name = m.group(1)
        if name not in EVENT_NAMES:
            out.append(content[i:m.end()])
            i = m.end()
            continue
        # Also skip if it's already prefixed with 'on' (defensive)
        # (e.g. if someone wrote `onclick={...}`, the regex would match 'onclick' as name, not 'click')
        # Actually the regex `[a-zA-Z]+` would match the full `onclick` — so we're safe here.
        # Find the closing brace
        brace_open = m.end() - 1
        brace_close = find_balance(content, brace_open)
        if brace_close == -1:
            out.append(content[i:m.end()])
            i = m.end()
            continue
        # Replace `name={` with `onname={` — keep the rest as is
        out.append(content[i:m.start()])
        out.append(f'on{name}={{')
        out.append(content[m.end():brace_close + 1])
        changes += 1
        i = brace_close + 1
    new_content = ''.join(out)
    if new_content != content:
        path.write_text(new_content, encoding='utf-8')
    return changes


def main():
    if len(sys.argv) < 2:
        print("Usage: fix_on_prefix.py <dir>")
        sys.exit(1)
    root = Path(sys.argv[1])
    total = 0
    for svelte in sorted(root.rglob('*.svelte')):
        n = transform_file(svelte)
        if n:
            print(f"  {svelte}: {n} event(s) restored `on` prefix")
            total += n
    print(f"Done. Total events fixed: {total}")


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Fix Svelte 5 onMount(async () => ...) -> onMount(() => { (async () => {...})(); return cleanup; })

Scans .svelte files for onMount(async () => { ... return () => {...}; }); patterns
and converts them so the cleanup function stays in the synchronous onMount callback
while the await-able body runs inside an IIFE.
"""

import re
import sys
from pathlib import Path

def find_onmount_blocks(content: str):
    """Find onMount(async () => { ... }) blocks including nested braces."""
    results = []
    needle = "onMount(async () => {"
    idx = 0
    while True:
        start = content.find(needle, idx)
        if start == -1:
            break
        # Find matching closing brace by counting braces from the '{' after '=>'
        brace_start = content.find("{", start + len(needle) - 1)
        if brace_start == -1:
            break
        depth = 0
        i = brace_start
        while i < len(content):
            c = content[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        # i is at the closing '}'. Find the ');' after it
        end = content.find(");", i)
        if end == -1:
            break
        block_start = start
        block_end = end + 2  # include ');'
        results.append((block_start, block_end, content[block_start:block_end]))
        idx = block_end
    return results


def transform_block(block: str) -> str:
    """Transform a single onMount(async ...) block."""
    # Strip 'onMount(' and trailing ');'
    assert block.startswith("onMount(") and block.rstrip().endswith(");")
    inner = block[len("onMount("):]
    # inner ends with ');' -- but there might be a trailing newline; strip just the ');'
    # find last ');'
    last_paren_semi = inner.rfind(");")
    arrow_body = inner[:last_paren_semi]
    # arrow_body now looks like: async () => { ... }
    assert arrow_body.startswith("async () => {")
    assert arrow_body.rstrip().endswith("}")
    # Remove the outer 'async () => {' and final '}'
    body_inner = arrow_body[len("async () => {"):]
    body_inner = body_inner.rstrip()
    if body_inner.endswith("}"):
        body_inner = body_inner[:-1]
    # body_inner is the original onMount body. Now we want to extract any `return () => { ... };` cleanup.
    # Look for the LAST `return () => {` ... `};` at depth 0 of body_inner
    # Strategy: find the last top-level `return ` that is followed by an arrow function
    # Simpler: find the last `return () => {` and parse its body.
    cleanup_marker = "return () => {"
    cleanup_idx = body_inner.rfind(cleanup_marker)
    if cleanup_idx == -1:
        # No cleanup — entire body becomes IIFE
        new_body = "(async () => {" + body_inner + "\n  })();"
        return "onMount(() => {\n" + new_body + "\n});"
    # Otherwise: everything before `return () => {` is async body; everything from there is cleanup.
    async_part = body_inner[:cleanup_idx].rstrip()
    if async_part.endswith(";"):
        async_part = async_part[:-1]
    cleanup_part_full = body_inner[cleanup_idx:]
    # cleanup_part_full is like: 'return () => { ... };'
    # Remove the leading 'return ' so we keep '() => { ... };' (without trailing ;)
    cleanup_part = cleanup_part_full[len("return "):].rstrip()
    if cleanup_part.endswith(";"):
        cleanup_part = cleanup_part[:-1]
    new_block = "onMount(() => {\n  (async () => {" + async_part + "\n  })();\n  " + cleanup_part + ";\n});"
    return new_block


def fix_file(path: Path) -> int:
    content = path.read_text(encoding="utf-8")
    blocks = find_onmount_blocks(content)
    if not blocks:
        return 0
    # Apply transformations in reverse order so offsets stay valid
    new_content = content
    for start, end, block in reversed(blocks):
        new_block = transform_block(block)
        new_content = new_content[:start] + new_block + new_content[end:]
    if new_content != content:
        path.write_text(new_content, encoding="utf-8")
        return len(blocks)
    return 0


def main():
    if len(sys.argv) < 2:
        print("Usage: fix_onmount.py <dir>")
        sys.exit(1)
    root = Path(sys.argv[1])
    total = 0
    for svelte in root.rglob("*.svelte"):
        n = fix_file(svelte)
        if n:
            print(f"  Fixed {n} block(s) in {svelte}")
            total += n
    print(f"Done. Total blocks fixed: {total}")


if __name__ == "__main__":
    main()

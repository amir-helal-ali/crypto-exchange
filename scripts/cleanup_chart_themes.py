#!/usr/bin/env python3
"""
Strip light-mode branches from NexusChart.svelte and DepthChart.svelte.
After the theme.ts dark-only refactor, `theme` is always 'dark', so every
`theme === 'light' ? X : Y` becomes just `Y`, and every
`isLight ? X : Y` becomes just `Y`.
"""

import re
import sys
from pathlib import Path

FILES = [
    "/home/z/my-project/crypto-exchange/frontend/src/lib/components/NexusChart.svelte",
    "/home/z/my-project/crypto-exchange/frontend/src/lib/components/DepthChart.svelte",
]

# Pattern: `theme === 'light' ? <X> : <Y>`  -> <Y>
# We need a balanced-expression matcher because X and Y can themselves contain
# parens, strings, etc. We'll write a small custom scanner.

def match_balanced(s: str, start: int) -> int:
    """Given s and position of '?' in ternary, return index past the false-branch."""
    # start points at '?'. Skip whitespace.
    i = start + 1
    i = skip_ws(s, i)
    # Parse true-branch
    i = parse_expr(s, i)
    i = skip_ws(s, i)
    assert s[i] == ':', f"Expected ':' at {i}, got {s[i:i+20]!r}"
    i += 1
    i = skip_ws(s, i)
    # Parse false-branch
    i = parse_expr(s, i)
    return i


def skip_ws(s: str, i: int) -> int:
    while i < len(s) and s[i] in ' \t\n\r':
        i += 1
    return i


def parse_expr(s: str, i: int) -> int:
    """Parse a balanced expression starting at i. Return index past it."""
    i = skip_ws(s, i)
    depth = 0
    in_str = None  # quote char
    while i < len(s):
        ch = s[i]
        if in_str:
            if ch == '\\':
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ('"', "'", '`'):
            in_str = ch
            i += 1
            continue
        if ch in '([{':
            depth += 1
            i += 1
            continue
        if ch in ')]}':
            if depth == 0:
                break
            depth -= 1
            i += 1
            continue
        if depth == 0 and ch in ',;:?':
            # If ':' appears at depth 0, it's a ternary separator we want to leave alone
            # for the caller to handle. Same for ',' (arg sep) and ';'.
            break
        if ch == '?':
            # Nested ternary — parse it whole
            i = match_balanced(s, i)
            continue
        i += 1
    return i


def strip_theme_ternary(src: str) -> tuple[str, int]:
    """Replace `theme === 'light' ? X : Y` -> `Y` and `theme !== 'light' ? X : Y` -> `X`."""
    # Repeatedly scan for occurrences of `theme === 'light' ?` or `theme !== 'light' ?`
    # (with optional whitespace).
    pattern = re.compile(r"theme\s*(===|!==)\s*'light'\s*\?")
    count = 0
    while True:
        m = pattern.search(src)
        if not m:
            break
        cond_op = m.group(1)
        q_pos = m.end() - 1  # position of '?'
        end = match_balanced(src, q_pos)
        # Recompute the true-branch and false-branch spans
        # true-branch starts after '?' (skip ws), ends at ':' (skip ws before)
        i = q_pos + 1
        i = skip_ws(src, i)
        true_start = i
        true_end = parse_expr(src, i)
        i = skip_ws(src, true_end)
        assert src[i] == ':'
        i += 1
        i = skip_ws(src, i)
        false_start = i
        false_end = parse_expr(src, i)
        # Sanity check: false_end should equal `end`
        true_expr = src[true_start:true_end].strip()
        false_expr = src[false_start:false_end].strip()
        if cond_op == '===':
            # light -> X, dark -> Y. We want dark, so keep Y (false_expr)
            replacement = false_expr
        else:
            # !== 'light' (i.e. dark) -> X (true). Keep X.
            replacement = true_expr
        src = src[:m.start()] + replacement + src[end:]
        count += 1
    return src, count


def strip_isLight_ternary(src: str) -> tuple[str, int]:
    """Replace `isLight ? X : Y` -> `Y` and `!isLight ? X : Y` -> `X`."""
    pattern = re.compile(r"(?<![A-Za-z0-9_])(!?)isLight\s*\?")
    count = 0
    while True:
        m = pattern.search(src)
        if not m:
            break
        negate = (m.group(1) == '!')
        q_pos = m.end() - 1
        end = match_balanced(src, q_pos)
        i = q_pos + 1
        i = skip_ws(src, i)
        true_start = i
        true_end = parse_expr(src, i)
        i = skip_ws(src, true_end)
        assert src[i] == ':'
        i += 1
        i = skip_ws(src, i)
        false_start = i
        false_end = parse_expr(src, i)
        true_expr = src[true_start:true_end].strip()
        false_expr = src[false_start:false_end].strip()
        # isLight is always false (theme is always 'dark')
        if not negate:
            replacement = false_expr  # dark branch
        else:
            replacement = true_expr   # !isLight (i.e. dark) branch
        src = src[:m.start()] + replacement + src[end:]
        count += 1
    return src, count


def strip_if_theme_light_block(src: str) -> tuple[str, int]:
    """
    Replace `if (theme !== 'light') { A } else { B }` with `A`.
    Replace `if (theme === 'light') { A } else { B }` with `B`.
    Replace `if (theme !== 'light') { A }` (no else) with `A`.
    Replace `if (theme === 'light') { A }` (no else) with `` (remove).
    """
    count = 0

    # Pattern with else: if (theme OP 'light') { ... } else { ... }
    pattern_else = re.compile(r"if\s*\(\s*theme\s*(===|!==)\s*'light'\s*\)\s*\{")
    while True:
        m = pattern_else.search(src)
        if not m:
            break
        op = m.group(1)
        # find matching brace for the if-body
        body_start = m.end() - 1  # at '{'
        body_end = find_matching_brace(src, body_start)
        after_body = body_end + 1
        # Skip ws, expect 'else'
        i = skip_ws(src, after_body)
        else_kw = re.match(r"else\s*\{", src[i:])
        if not else_kw:
            # No else branch
            inner = src[body_start + 1:body_end]
            if op == '===':
                # light body — drop entirely
                replacement = ""
            else:
                # dark body — keep
                replacement = inner.strip()
            # Preserve statement boundary — add nothing
            src = src[:m.start()] + replacement + src[after_body:]
            count += 1
            continue
        else_body_start = i + else_kw.end() - 1  # at '{'
        else_body_end = find_matching_brace(src, else_body_start)
        after_else = else_body_end + 1
        if_body = src[body_start + 1:body_end]
        else_body = src[else_body_start + 1:else_body_end]
        if op == '===':
            # light ? if_body : else_body → keep else_body
            replacement = else_body.strip()
        else:
            # dark ? if_body : else_body → keep if_body
            replacement = if_body.strip()
        src = src[:m.start()] + replacement + src[after_else:]
        count += 1

    # Handle lone `if (theme === 'light') { ... }` (no else) — remove
    # (Already handled above when no else is found for === case.)
    # Handle lone `if (theme !== 'light') { ... }` (no else) — unwrap.
    # (Already handled above when no else is found for !== case.)
    return src, count


def find_matching_brace(s: str, open_pos: int) -> int:
    """Given index of '{' at open_pos, return index of matching '}'."""
    assert s[open_pos] == '{'
    depth = 0
    i = open_pos
    in_str = None
    while i < len(s):
        ch = s[i]
        if in_str:
            if ch == '\\':
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ('"', "'", '`'):
            in_str = ch
            i += 1
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("Unbalanced braces")


def main():
    total_count = 0
    for fp in FILES:
        p = Path(fp)
        if not p.exists():
            print(f"!! not found: {fp}", file=sys.stderr)
            continue
        src = p.read_text(encoding='utf-8')
        original = src
        src, c1 = strip_theme_ternary(src)
        src, c2 = strip_isLight_ternary(src)
        # Re-run strip_theme_ternary in case isLight removals revealed new ones
        src, c3 = strip_theme_ternary(src)
        src, c4 = strip_if_theme_light_block(src)
        # Final pass — sometimes nested ternaries were inside if-bodies
        src, c5 = strip_theme_ternary(src)
        src, c6 = strip_isLight_ternary(src)
        if src != original:
            p.write_text(src, encoding='utf-8')
            n = c1 + c2 + c3 + c4 + c5 + c6
            print(f"[ok] {fp}: {n} light-mode branches removed")
            total_count += n
        else:
            print(f"[--] {fp}: no changes")
    print(f"\nTotal replacements: {total_count}")


if __name__ == '__main__':
    main()

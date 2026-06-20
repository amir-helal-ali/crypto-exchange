#!/usr/bin/env python3
"""
Convert deprecated Svelte 4 event directives (on:click, on:submit, on:input, etc.)
to Svelte 5 event attribute syntax (onclick, onsubmit, oninput).

Also handles:
- on:click={handler}              -> onclick={handler}
- on:click={(e) => ...}           -> onclick={(e) => ...}
- on:click|stopPropagation={...}  -> onclick={(e) => { e.stopPropagation(); ... }}
- on:click|preventDefault={...}   -> onclick={(e) => { e.preventDefault(); ... }}
- on:keydown={(e) => ...}         -> onkeydown={(e) => ...}
- on:input={...}                  -> oninput={...}
- on:change={...}                 -> onchange={...}
- on:submit|preventDefault={...}  -> onsubmit={(e) => { e.preventDefault(); ... }}

Only converts on:XXX forms — leaves existing attribute forms alone.
"""

import re
import sys
from pathlib import Path


# Event names we know about — covers DOM events
EVENT_NAMES = {
    'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave',
    'mouseover', 'mouseout', 'keydown', 'keyup', 'keypress', 'input', 'change',
    'submit', 'reset', 'focus', 'blur', 'focusin', 'focusout', 'wheel', 'scroll',
    'contextmenu', 'drag', 'dragend', 'dragenter', 'dragleave', 'dragover', 'dragstart', 'drop',
    'touchstart', 'touchend', 'touchmove', 'touchcancel', 'pointerdown', 'pointerup', 'pointermove',
    'pointerenter', 'pointerleave', 'pointercancel', 'pointerover', 'pointerout',
    'play', 'pause', 'ended', 'loadeddata', 'loadedmetadata', 'loadstart', 'progress', 'timeupdate',
    'volumechange', 'waiting', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'stalled', 'suspend',
    'abort', 'error', 'load', 'beforeunload', 'unload', 'resize', 'hashchange', 'popstate',
    'animationstart', 'animationend', 'animationiteration', 'transitionend', 'transitionstart', 'transitionrun',
    'compositionstart', 'compositionend', 'compositionupdate', 'copy', 'cut', 'paste',
    'fullscreenchange', 'fullscreenerror', 'visibilitychange', 'pointerlockchange', 'pointerlockerror',
}


# Regex to find: on:NAME[|modifier]*={EXPR}
# We capture: (1) name, (2) modifiers (e.g. "|preventDefault|stopPropagation"), (3) expr
# The expr must be balanced braces — we handle that ourselves.
ON_COLON_PATTERN = re.compile(r'on:([a-zA-Z]+)((?:\|[a-zA-Z]+)*)=\{')


def find_balance(s: str, start: int) -> int:
    """Given s and position of '{', find the matching '}'."""
    assert s[start] == '{'
    depth = 1
    i = start + 1
    in_str = None  # '"', "'", or '`'
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


def transform_event(name: str, modifiers: str, expr: str) -> str:
    """Transform on:name|mods={expr} into a Svelte 5 event attribute."""
    if name not in EVENT_NAMES:
        # Unknown event name — leave it alone (return original form)
        return None

    mods = [m for m in modifiers.split('|') if m]
    has_prevent_default = 'preventDefault' in mods
    has_stop_propagation = 'stopPropagation' in mods
    has_stop_immediate = 'stopImmediatePropagation' in mods
    has_self = 'self' in mods
    has_once = 'once' in mods
    has_trusted = 'trusted' in mods

    # For simple cases (no modifiers), just rename the attribute
    # Svelte 5 attribute form keeps the `on` prefix: onclick, onsubmit, oninput...
    if not mods:
        return f'on{name}={{{expr}}}'

    # For modifiers, wrap the handler so they're applied
    # If expr looks like a bare identifier (e.g. `handleClick`), wrap as (e) => { ...; expr(e); }
    # If expr looks like an arrow (e) => {...}, we still want to call it after applying modifiers.
    # Simplest: always wrap.

    prelude_lines = []
    if has_prevent_default:
        prelude_lines.append('e.preventDefault()')
    if has_stop_propagation:
        prelude_lines.append('e.stopPropagation()')
    if has_stop_immediate:
        prelude_lines.append('e.stopImmediatePropagation()')

    prelude = '; '.join(prelude_lines)
    if prelude:
        prelude = prelude + '; '

    # Build the wrapped handler
    # If expr is a bare identifier, call it as expr(e)
    # If it's an arrow or function expression, call it as (expr)(e)
    bare_ident = re.fullmatch(r'[a-zA-Z_$][a-zA-Z0-9_$]*', expr.strip()) is not None
    if bare_ident:
        call = f'{expr.strip()}(e)'
    else:
        call = f'({expr})(e)'

    # For `self` and `once` and `trusted`, we'd need more wrapping, but skip them
    # for now — most of our usage is just preventDefault + stopPropagation.
    if has_self or has_once or has_trusted:
        # Don't transform — too complex. Leave as on: for now (will still warn).
        return None

    body = f'(e) => {{ {prelude}{call}; }}'
    return f'on{name}={{{body}}}'


def transform_file(path: Path) -> int:
    content = path.read_text(encoding='utf-8')
    out = []
    i = 0
    n = len(content)
    changes = 0
    while i < n:
        m = ON_COLON_PATTERN.search(content, i)
        if not m:
            out.append(content[i:])
            break
        # Append content up to match
        out.append(content[i:m.start()])
        # Find the closing brace
        brace_open = m.end() - 1  # position of '{'
        brace_close = find_balance(content, brace_open)
        if brace_close == -1:
            # Unbalanced — give up on this match
            out.append(content[m.start():m.end()])
            i = m.end()
            continue
        expr = content[m.end():brace_close]
        new_attr = transform_event(m.group(1), m.group(2), expr)
        if new_attr is None:
            # Couldn't transform — keep original
            out.append(content[m.start():brace_close + 1])
        else:
            out.append(new_attr)
            changes += 1
        i = brace_close + 1
    new_content = ''.join(out)
    if new_content != content:
        path.write_text(new_content, encoding='utf-8')
    return changes


def main():
    if len(sys.argv) < 2:
        print("Usage: fix_svelte_events.py <dir>")
        sys.exit(1)
    root = Path(sys.argv[1])
    total = 0
    for svelte in sorted(root.rglob('*.svelte')):
        n = transform_file(svelte)
        if n:
            print(f"  {svelte}: {n} event(s) transformed")
            total += n
    print(f"Done. Total events transformed: {total}")


if __name__ == '__main__':
    main()

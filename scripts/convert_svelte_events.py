#!/usr/bin/env python3
"""Convert all Svelte 5 new event syntax to legacy syntax for consistency."""
import os
import re

ROOT = '/home/z/my-project/crypto-exchange/frontend/src'

EVENT_MAP = {
    'onclick': 'on:click',
    'onsubmit': 'on:submit',
    'oninput': 'on:input',
    'onchange': 'on:change',
    'onkeydown': 'on:keydown',
    'onkeyup': 'on:keyup',
    'onmouseover': 'on:mouseover',
    'onmousemove': 'on:mousemove',
    'onmousedown': 'on:mousedown',
    'onmouseup': 'on:mouseup',
    'onmouseleave': 'on:mouseleave',
    'onmouseenter': 'on:mouseenter',
    'onwheel': 'on:wheel',
    'onfocus': 'on:focus',
    'onblur': 'on:blur',
    'onload': 'on:load',
    'onerror': 'on:error',
    'ontoggle': 'on:toggle',
}

def convert_file(path: str) -> int:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for new, legacy in EVENT_MAP.items():
        pattern = re.compile(r'(?<![:\w])' + new + r'=')
        content = pattern.sub(legacy + '=', content)

    jsx_pattern = re.compile(
        r'\{([^{}]+?)\s*&&\s*<(?P<tag>\w+)([^>]*)>(?P<content>(?:(?!</(?P=tag)>).)*)</(?P=tag)>\}',
        re.DOTALL
    )
    def replace_jsx(m):
        cond = m.group(1).strip()
        tag = m.group('tag')
        attrs = m.group(3)
        content_inner = m.group('content')
        return f'{{#if {cond}}}<{tag}{attrs}>{content_inner}</{tag}>{{/if}}'

    content = jsx_pattern.sub(replace_jsx, content)

    jsx_self_closing = re.compile(
        r'\{([^{}]+?)\s*&&\s*<(?P<tag>\w+)([^>]*?)/>\}'
    )
    def replace_jsx_self(m):
        cond = m.group(1).strip()
        tag = m.group('tag')
        attrs = m.group(3)
        return f'{{#if {cond}}}<{tag}{attrs}/>{{/if}}'

    content = jsx_self_closing.sub(replace_jsx_self, content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return 1
    return 0

count = 0
for root, dirs, files in os.walk(ROOT):
    for f in files:
        if f.endswith('.svelte'):
            path = os.path.join(root, f)
            count += convert_file(path)
print(f'Converted {count} files')

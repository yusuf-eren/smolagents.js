import re

def escape_code_brackets(text: str) -> str:
    """Escapes square brackets in code segments while preserving Rich styling tags."""

    def replace_bracketed_content(match):
        content = match.group(1)
        cleaned = re.sub(
            r"bold|red|green|blue|yellow|magenta|cyan|white|black|italic|dim|\s|#[0-9a-fA-F]{6}",
            "",
            content,
        )
        return f"\\[{content}\\]" if cleaned.strip() else f"[{content}]"

    return re.sub(r"\[([^\]]*)\]", replace_bracketed_content, text)


r = escape_code_brackets("foo [bar] baz")
print(r)

xx = """
This is a test string with various bracketed content:
- [foo]
- [bold red] (should not be escaped)
- [bar123]
- [italic #d4b702]
- [baz qux]
- [bold] (should not be escaped)
- [red green blue]
- [#ff00ff]
- [bold italic #00ff00]
- [foo [bar] baz] (nested brackets, only outer will match)
- [   bold   ] (should not be escaped)
- [foo bar [baz]] (nested, only outer will match)
- [bold foo] (should be escaped)
- [foo] [bar] [baz]
- [bold][italic][red]
- [foo[bar]baz]
- [foo]bar[baz]
- [bold]foo[bar]
- [foo][bold][bar]
- [foo] [bold] [bar]
"""

print(escape_code_brackets(xx))
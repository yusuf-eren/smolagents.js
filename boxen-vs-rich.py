from rich import print
from rich.panel import Panel
from rich import box
from rich.syntax import Syntax
from rich.rule import Rule
from rich.console import Group
from rich.table import Table
from rich.text import Text

# # print(Panel("Hello", title="Greeting", border_style="#d4b702"))

# s = Panel(
#     Syntax(
#         """from rich import print
# from rich.panel import Panel

# print(Panel("Hello", title="Greeting", border_style="#d4b702"))""",
#         lexer="python",
#         theme="monokai",
#         word_wrap=True,
#     ),
#     title="[bold] Greeting",
#     title_align="left",
#     box=box.HORIZONTALS,
# )


# print(s)


title = "dalga"
subtitle = "subtitle"
content = """from rich import print
from rich.panel import Panel

# print(Panel("Hello", title="Greeting", border_style="#d4b702"))"""

# qpn = Panel(
#     Syntax(
#         content,
#         lexer="python",
#         theme="monokai",
#         word_wrap=True,
#     ),
#     title="[bold]" + title,
#     title_align="left",
#     box=box.HORIZONTALS,
# )

# print(qpn)


# print("---------------- ANOTHER RULE PY\n\n")

# another_rule = Rule(
#     "[bold]" + title,
#     characters="━",
#     style="#d4b702",
# )

# print(another_rule)


# print("---subTITLE")
# print(
#     Panel(
#         f"\n[bold]{content}\n",
#         title="[bold]New run" + (f" - {title}" if title else ""),
#         subtitle=subtitle,
#         border_style="#d4b702",
#         subtitle_align="left",
#     )
# )

print("how it looks")

markdown_content = Syntax(
    content,
    lexer="markdown",
    theme="github-dark",
    word_wrap=True,
)

print(markdown_content)

print("\n\n\n RULE START\n\n\n")
r = Rule(
    "[bold italic]" + title,
    align="left",
    style="#d4b702",
)
print("rule", r)
print("\n\n\n RULE END\n\n\n")

print("\n\n\n GROUP START\n\n\n")

r = Group(
    Rule(
        "[bold italic]" + title,
        align="left",
        style="#d4b702",
    ),
    markdown_content,
)
print(r)

print("\n\n\n GROUP END\n\n\n")

print("\n\n\n TABLE START\n\n\n")
t = Table(show_header=True, header_style="bold")
t.add_column("Name", justify="right", style="cyan", no_wrap=True)
t.add_column("Age", justify="right", style="magenta")
t.add_column("Type", justify="left", style="green")
t.add_row("Robin", "22", "Python")
t.add_row("Max", "20", "C")
t.add_row("John", "23", "Java")
print(t)
print("\n\n\n TABLE END\n\n\n")


print("\n\n\n TEXT START\n\n\n")
console_outputs = "Hello"
print(Text(console_outputs, style="dim"))
print("\n\n\n TEXT END\n\n\n")

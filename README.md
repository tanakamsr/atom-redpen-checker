# atom-redpen-checker - Atom package

Check your document using [RedPen](http://redpen.cc/).

## Installation

````
$ apm install atom-redpen-checker
````

## Usage

### Install `Redpen` Command line tool

This package requires Redpen Command line tool('RedPen CLI') version 1.5 or greater.

See [Redpen Quickstart](http://redpen.cc/docs/latest/index.html#quickstart).

### Setup

This package needs set up some paths from Settings.

- RedPen CLI path
    - You set the path of installed RedPen CLI.
    Default path is `/usr/local/redpen/bin/redpen`.
- RedPen configuration XML file path
    - You can set your configuration XML file.
    If empty as the default, this package uses the configuration file determined by Redpen's default behavior.
- JAVA_HOME path
    - RedPen CLI required JAVA_HOME path.

### Run

1. Open a text file of the document type shown below..
    - Plain
    - Markdown
    - Textile
    - Asciidoc (requires RedPen version 1.3 or higher)
    - LaTex (requires RedPen version 1.4 or higher)
2. Select the `Atom Redpen Checker: Validate` command from Command Pallette.
You can also execute it by Package menu, right-click, `ctrl-alt-o`.
3. You can see report pane at bottom.

You can use `Validate on save` option from Settings If you want to run validation each time a file is saved.

It is also possible to verify only the selected range of text from the context menu.

### Select Redpen configuration
Add the path of the Redpen configuration file to the atom-redpen-check.cson file in the config folder (~ / .atom). Follow the example below.

#### Example
```cson
[
  {
    title: "Rule Ja"
    path: "/home/redpen/rule/redpen-conf-ja.xml"
  }
  {
    title: "Rule en"
    path: "/home/redpen/rule/redpen-conf-en.xml"
  }
  {
    title: "Another Rule"
    path: "/home/redpen/rule/another/redpen-conf.xml"
  }
]
```

You can select a rule by displaying a selection list from the context menu.

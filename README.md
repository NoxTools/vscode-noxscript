# Nox Script for Visual Studio Code

This extension adds language support for the NoxScript 3.0 language to VS Code, including:

- Syntax Highlighting
- Completion Lists (auto-complete)
- Signature Help (for built-in and user-defined functions)
- Compiler integration (F5)

_Note_: Compiler integration is currently supported only for Windows and Linux.

### IDE Features
![IDE](http://i.giphy.com/3o7TKnScB4qPMfx4lO.gif)

## How to use

You need to download and install the latest [Visual Studio Code](https://code.visualstudio.com/download) first.

Once Visual Studio Code is installed, download the [extension](https://github.com/NoxTools/vscode-noxscript/releases/latest) (_language-client-noxscript-x.x.x.vsix_) from the release.

Either drag-and-drop the _vsix_ file to Visual Studio Code, or open it in Visual Studio Code. This should install the Nox Script language support extension, and you can check that from the extensions tab on the left.

### Commands

There is only 1 command that is supported in this extension at the moment.

- `Nox Script: compile`: On Windows or Linux, you can open up the command palette (`ctrl+shift+p`) and select `Nox Script: compile`. You can also press F5 to quickly compile the current source.


## Examples

You can check out the language documentations and examples [here](https://noxtools.github.io/noxscript/).
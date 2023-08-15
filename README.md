# Gamma

## Get up and running the Web Extension

- Run `npm install` (note: you only need to do this once)
- Run `npm run compile` (note: you only need to do this once)
- Debug via F5 (Run Web Extension).
- In the new window, add your OpenAI API key under "Settings -> Extensions -> Gamma"

## Deploy in a browser

- Run `npm install` (note: you only need to do this once)
- Run `npm run compile` (note: you only need to do this once)
- Run `npm run in-browser`

## Sending to remote users (using deployed extension)

- Ask the participant to **either**:
    - install [Visual Studio Code](https://code.visualstudio.com/) on their computer
    - ...or visit [vscode.dev](https://vscode.dev/)
- Open "Extensions" and search for "(ANONYMIZED)"
- Click "install"
- Send a `.dpage` file (such as one of the ones in the web programming basics directory) and ask them to open it

## Sending to remote users (`.vsix` file)

To send the latest, non-published code you can package it as a `.vsix` file.

- Ask the participant to install [Visual Studio Code](https://code.visualstudio.com/) on their computer
- On your computer, run `npm install` (note: you only need to do this once)
- On your computer, run `npm run gen-vsix`
    - This should generate a file named `xxxx-?.?.?.vsix`
- Send the participant the `.vsix` file
- Ask them to open "Settings -> Extensions -> "..." -> Install from VSIX
    - They can also open the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette) and type "Install from VSIX"
- Send a `.dpage` file (such as one of the ones in the web programming basics directory) and ask them to open it

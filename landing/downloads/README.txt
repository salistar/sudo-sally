SallySudo — downloads/
==========================

This folder is where the release build of the Android app lands.

At deploy time the CI/CD pipeline drops the signed APK here as:

    sudoku-sally.apk

The download page (../download.html) links to ./downloads/sudoku-sally.apk,
so once the pipeline copies the file into this directory the "Download for
Android (APK)" button will work with no further changes.

Do NOT commit a real binary into source control — the APK is a build
artifact produced by CI and added during the Docker image build / deploy step.

Current target release: v3.1
GitHub releases: https://github.com/salistar/sudo-sally/releases/latest

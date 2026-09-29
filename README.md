# googledrive-audiogata

An [AudioGata](https://github.com/InfoGata/audiogata) plugin that syncs your
playlists and favorites between devices through Google Drive.

[Installation Link](https://www.audiogata.com/plugininstall?manifestUrl=https://cdn.jsdelivr.net/gh/InfoGata/googledrive-audiogata@latest/manifest.json)

After installing, open AudioGata Settings → Cloud Sync, choose Google Drive and
log in. AudioGata then syncs by itself: shortly after you change something,
periodically, and whenever the app is opened or put in the background.

The library is stored as a single automerge file, `audiogata-library.automerge`,
in the hidden app data folder of your Drive (`drive.appdata` scope), so the
plugin can't see or touch any of your other files. Changes made on different
devices are merged, deletions included.

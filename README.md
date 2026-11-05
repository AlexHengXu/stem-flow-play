# Stem Flow — Public Playtest

Open https://AlexHengXu.github.io/stem-flow-play/ in desktop Chrome, allow camera access, then click Start. Enter FX and press J for Chorus, Tremolo, Distortion and Beat Repeat.

For a camera-free comparison, open fx-test.html, choose a song and stem, and click Load and play.

This repository contains only the current playable export. Assets are colocated for publishing; development continues in the original private folder-based project.

## November 6 recording fix

Check **Record game screen + remix audio**, click Start, and choose the Stem Flow browser tab. Cancel to stay in setup and retry. Pause/Continue controls the recording; End or Stop sharing saves it. Restart discards the previous run. Recording includes the game mix, without requiring microphone or system audio. WebM/VP8 is preferred; MP4 is a fallback where supported.

Hand tracking requests 640x360 at 30 fps. Rendering reduces its batch size during recording or expensive draws, and avoids repeated FX layout reads. These changes reduce work; actual performance depends on the device.

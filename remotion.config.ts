import {Config} from '@remotion/cli/config';

// If the project lives under a non-ASCII path (e.g. Cyrillic folder names), Chrome headless may fail
// with "icudtl.dat not found": copy the browser to an ASCII path and point to it here:
// Config.setBrowserExecutable('/Users/you/.cache/remotion-chrome/chrome-headless-shell-mac-arm64/chrome-headless-shell');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');

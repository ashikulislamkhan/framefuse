/**
 * FrameFuse configuration: the single place that knows about Google Drive.
 * Phase 1 only uses the folder as the storage location for the PNGs listed in frames.json.
 * DRIVE_FOLDER_* are reserved for Phase 2 (a GitHub Action that generates frames.json).
 */
export const CONFIG = {
  DRIVE_FOLDER_ID: "1q8nktf9GOhpRo6iosibiTYWfpDweZ-RW",
  DRIVE_FOLDER_NAME: "FrameFuse",

  /** Where the frame registry lives (relative to the app root). */
  REGISTRY_URL: "frames.json",

  /** File id -> download URL. Tried in order until one returns an image (Drive's CORS support varies). */
  DRIVE_URL_TEMPLATES: [
    "https://lh3.googleusercontent.com/d/{id}=s0",
    "https://drive.usercontent.google.com/download?id={id}&export=download",
    "https://drive.google.com/uc?export=download&id={id}",
  ],

  /** Cache API bucket for downloaded frames (kept across app updates). */
  FRAME_CACHE: "framefuse-frames",
};

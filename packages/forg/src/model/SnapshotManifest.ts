export interface SnapshotManifest {
  layerFormat: string;
  appType: string;
  metadata?: { [key: string]: string };
}

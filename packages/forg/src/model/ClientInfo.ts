export interface ClientInfo {
  uuid: string;

  /**
   * ISO-8601 date.
   */
  joinedAt: string;

  displayName: string;

  libVersion: string;
  metadata?: {
    [key: string]: string;
  };
}

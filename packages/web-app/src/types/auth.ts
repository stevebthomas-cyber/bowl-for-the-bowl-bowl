export interface DiscordUser {
  id: string;              // Discord ID
  username: string;
  email?: string;
  avatar?: string;
}

export interface AuthenticatedUser {
  userId: string;          // Database UUID
  discordId: string;
  discordUsername: string;
  displayName: string;
  email?: string;
  roles: Array<{
    leagueId: string;
    role: 'commissioner' | 'asst_commissioner' | 'coach';
  }>;
  teamIds: string[];       // All teams owned by this user (coaches can own multiple teams)
  teamId?: string;         // Deprecated: kept for backward compatibility, use teamIds instead
}
